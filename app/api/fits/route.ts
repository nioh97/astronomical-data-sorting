/**
 * FITS ingestion API — POST multipart file; run Python pipeline; return FITSResult.
 * Isolated from CSV/LLM ingestion. Log stderr for debugging; differentiate 500/200/400.
 * Only say "corrupt" when astropy cannot open the file.
 */

import { NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, unlink, mkdir } from "fs/promises"
import path from "path"
import os from "os"
import type { FITSResult } from "@/lib/fits/fits-types"

const FITS_EXT = [".fits", ".fit", ".fz"]
const PYTHON_SCRIPT = "run_fits_pipeline.py"

function isFitsFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return FITS_EXT.some((ext) => lower.endsWith(ext))
}

export async function POST(request: Request) {
  let tempPath: string | null = null
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }
    const fileName = file.name
    if (!isFitsFileName(fileName)) {
      return NextResponse.json(
        { error: "File is not a FITS file (.fits, .fit, .fz)" },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const dir = process.cwd()
    const libFits = path.join(dir, "lib", "fits")
    const scriptPath = path.join(libFits, PYTHON_SCRIPT)
    const previewsDir = path.join(dir, "public", "previews")

    await mkdir(previewsDir, { recursive: true })

    const tempDir = os.tmpdir()
    tempPath = path.join(tempDir, `fits_${Date.now()}_${fileName}`)
    await writeFile(tempPath, buffer)

    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
      const py = spawn("python", [scriptPath, tempPath, previewsDir, fileName], {
        cwd: libFits,
        shell: false,
      })
      let stdout = ""
      let stderr = ""
      py.stdout?.on("data", (d) => { stdout += d.toString() })
      py.stderr?.on("data", (d) => { stderr += d.toString() })
      py.on("close", (code) => resolve({ stdout, stderr, code }))
      py.on("error", (err) => {
        resolve({ stdout: "", stderr: String(err), code: 1 })
      })
    })

    if (result.stderr?.length) {
      console.error("FITS Python stderr:", result.stderr.toString())
    }

    if (tempPath) {
      try {
        await unlink(tempPath)
      } catch {
        // ignore cleanup errors
      }
      tempPath = null
    }

    if (result.code !== 0) {
      return NextResponse.json(
        { error: "FITS processing failed internally" },
        { status: 500 }
      )
    }

    let data: FITSResult & { error?: string | null; message?: string }
    try {
      data = JSON.parse(result.stdout.trim()) as FITSResult & { error?: string | null; message?: string }
    } catch {
      return NextResponse.json(
        { error: "FITS processing failed internally" },
        { status: 500 }
      )
    }

    if (data.status === "valid_no_visualizable_data") {
      return NextResponse.json(data, { status: 200 })
    }

    // Only 400 when file cannot be opened or no numeric HDU; visualization/header failure != corrupted
    if (data.status === "error") {
      const userMessage = data.error ?? "This FITS file could not be processed."
      return NextResponse.json(
        { ...data, error: userMessage },
        { status: 400 }
      )
    }

    return NextResponse.json(data as FITSResult, { status: 200 })
  } catch (e) {
    if (tempPath) {
      try {
        await unlink(tempPath)
      } catch {
        // ignore
      }
    }
    console.error("FITS API error:", e)
    return NextResponse.json(
      { error: "FITS processing failed internally" },
      { status: 500 }
    )
  }
}
