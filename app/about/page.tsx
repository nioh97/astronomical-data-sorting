import Header from "@/components/cosmic/header"
import Footer from "@/components/cosmic/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="container mx-auto px-4 py-12 space-y-16 max-w-7xl">
        {/* Hero Section */}
        <section className="text-center py-12">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            About COSMIC Data Fusion
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            We are dedicated to revolutionizing astronomical data processing through innovative 
            cloud-enabled solutions that unify datasets from multiple space agencies.
          </p>
        </section>

        {/* Mission Section */}
        <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Mission</h2>
          <p className="text-slate-700 leading-relaxed text-lg">
            To bridge the gap between fragmented astronomical datasets by providing a unified, 
            cloud-enabled platform that enables seamless data fusion, standardization, and analysis 
            across multiple space agencies and observatories. We aim to accelerate astronomical 
            research by eliminating data silos and enabling collaborative, AI-driven discoveries.
          </p>
        </section>

        {/* Vision Section */}
        <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Vision</h2>
          <p className="text-slate-700 leading-relaxed text-lg">
            To become the leading platform for astronomical data fusion, where researchers worldwide 
            can effortlessly access, combine, and analyze heterogeneous datasets from NASA, ESA, JAXA, 
            and other space agencies. We envision a future where data fragmentation is no longer a 
            barrier to groundbreaking astronomical discoveries.
          </p>
        </section>

        {/* Team Section */}
        <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Team Member 1 */}
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className="w-32 h-32 border-4 border-slate-200">
                    <AvatarImage src="/akif.png" alt="Aqeef Khan" />
                    <AvatarFallback className="text-2xl bg-slate-100 text-slate-700">
                      AK
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Aqeef Khan</h3>
                    <p className="text-slate-600 font-medium mt-1">Developer</p>
                    <p className="text-slate-700 mt-3">
                      Passionate about building scalable cloud solutions and transforming complex 
                      data challenges into elegant technical solutions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Member 2 */}
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className="w-32 h-32 border-4 border-slate-200">
                    <AvatarImage src="/revathi.jpeg" alt="Revathi Lyju" />
                    <AvatarFallback className="text-2xl bg-slate-100 text-slate-700">
                      RL
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Revathi Lyju</h3>
                    <p className="text-slate-600 font-medium mt-1">Research and Documentation</p>
                    <p className="text-slate-700 mt-3">
                      Dedicated to advancing astronomical research through comprehensive documentation 
                      and ensuring scientific accuracy in data fusion methodologies.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Values Section */}
        <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Innovation</h3>
              <p className="text-slate-700">
                We continuously push the boundaries of what's possible in astronomical data processing 
                and cloud computing.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Collaboration</h3>
              <p className="text-slate-700">
                We believe in the power of open science and collaborative research to drive 
                astronomical discoveries.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Accuracy</h3>
              <p className="text-slate-700">
                Scientific integrity and data accuracy are at the core of everything we do.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Accessibility</h3>
              <p className="text-slate-700">
                We strive to make advanced astronomical data processing accessible to researchers 
                worldwide.
              </p>
            </div>
          </div>
        </section>

        {/* What We Do Section */}
        <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">What We Do</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Data Ingestion & Standardization</h3>
              <p className="text-slate-700">
                We automatically ingest and standardize heterogeneous astronomical datasets from multiple 
                sources, converting them into a unified canonical schema.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Cloud-Enabled Processing</h3>
              <p className="text-slate-700">
                Our platform leverages cloud computing to handle large-scale astronomical data processing 
                efficiently and cost-effectively.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Unified Repository</h3>
              <p className="text-slate-700">
                We maintain a centralized repository that enables seamless access to harmonized datasets 
                from multiple space agencies.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Visualization & Insights</h3>
              <p className="text-slate-700">
                We provide powerful visualization tools and AI-driven insights to help researchers 
                discover patterns and relationships in astronomical data.
              </p>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  )
}

