import Header from "@/components/cosmic/header"
import Footer from "@/components/cosmic/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Target, Eye, Users, Sparkles, Database, Cloud, Archive, BarChart3 } from "lucide-react"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="container mx-auto px-4 py-16 space-y-20 max-w-7xl">
        {/* Hero Section */}
        <section className="text-center py-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            About COSMIC Data Fusion
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            We are dedicated to revolutionizing astronomical data processing through innovative 
            cloud-enabled solutions that unify datasets from multiple space agencies.
          </p>
        </section>

        {/* Mission Section */}
        <section className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-8">
            <Target className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            <h2 className="text-3xl font-bold text-slate-900 section-header-underline">Our Mission</h2>
          </div>
          <p className="text-slate-700 leading-relaxed text-lg mt-4">
            To bridge the gap between fragmented astronomical datasets by providing a unified, 
            cloud-enabled platform that enables seamless data fusion, standardization, and analysis 
            across multiple space agencies and observatories. We aim to accelerate astronomical 
            research by eliminating data silos and enabling collaborative, AI-driven discoveries.
          </p>
        </section>

        {/* Vision Section */}
        <section className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-8">
            <Eye className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            <h2 className="text-3xl font-bold text-slate-900 section-header-underline">Our Vision</h2>
          </div>
          <p className="text-slate-700 leading-relaxed text-lg mt-4">
            To become the leading platform for astronomical data fusion, where researchers worldwide 
            can effortlessly access, combine, and analyze heterogeneous datasets from NASA, ESA, JAXA, 
            and other space agencies. We envision a future where data fragmentation is no longer a 
            barrier to groundbreaking astronomical discoveries.
          </p>
        </section>

        {/* Team Section */}
        <section className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-12">
            <Users className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            <h2 className="text-3xl font-bold text-slate-900 section-header-underline">Our Team</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Team Member 1 */}
            <Card className="border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center text-center space-y-5">
                  <Avatar className="w-32 h-32 border-4 border-slate-200 shadow-md">
                    <AvatarImage src="/akif.png" alt="Aqeef Khan" className="object-cover object-center" style={{ aspectRatio: 'auto' }} />
                    <AvatarFallback className="text-2xl bg-slate-100 text-slate-700">
                      AK
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900">Aqeef Khan</h3>
                    <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-slate-700 font-medium">
                      Developer
                    </Badge>
                    <p className="text-slate-700 mt-4 leading-relaxed">
                      Passionate about building scalable cloud solutions and transforming complex 
                      data challenges into elegant technical solutions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Member 2 */}
            <Card className="border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center text-center space-y-5">
                  <Avatar className="w-32 h-32 border-4 border-slate-200 shadow-md">
                    <AvatarImage src="/revathi.jpeg" alt="Revathi Lyju" className="object-cover object-center" style={{ aspectRatio: 'auto' }} />
                    <AvatarFallback className="text-2xl bg-slate-100 text-slate-700">
                      RL
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900">Revathi Lyju</h3>
                    <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-slate-700 font-medium">
                      Research and Documentation
                    </Badge>
                    <p className="text-slate-700 mt-4 leading-relaxed">
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
        <section className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-10">
            <Sparkles className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            <h2 className="text-3xl font-bold text-slate-900 section-header-underline">Our Values</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors duration-200">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Innovation</h3>
              <p className="text-slate-700 leading-relaxed">
                We continuously push the boundaries of what's possible in astronomical data processing 
                and cloud computing.
              </p>
            </div>
            <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors duration-200">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Collaboration</h3>
              <p className="text-slate-700 leading-relaxed">
                We believe in the power of open science and collaborative research to drive 
                astronomical discoveries.
              </p>
            </div>
            <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors duration-200">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Accuracy</h3>
              <p className="text-slate-700 leading-relaxed">
                Scientific integrity and data accuracy are at the core of everything we do.
              </p>
            </div>
            <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors duration-200">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Accessibility</h3>
              <p className="text-slate-700 leading-relaxed">
                We strive to make advanced astronomical data processing accessible to researchers 
                worldwide.
              </p>
            </div>
          </div>
        </section>

        {/* What We Do Section */}
        <section className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-10">
            <Database className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            <h2 className="text-3xl font-bold text-slate-900 section-header-underline">What We Do</h2>
          </div>
          <div className="space-y-6">
            <div className="p-5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-md bg-gradient-to-br from-blue-50 to-purple-50">
                  <Database className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Data Ingestion & Standardization</h3>
                  <p className="text-slate-700 leading-relaxed">
                    We automatically ingest and standardize heterogeneous astronomical datasets from multiple 
                    sources, converting them into a unified canonical schema.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-md bg-gradient-to-br from-blue-50 to-purple-50">
                  <Cloud className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Cloud-Enabled Processing</h3>
                  <p className="text-slate-700 leading-relaxed">
                    Our platform leverages cloud computing to handle large-scale astronomical data processing 
                    efficiently and cost-effectively.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-md bg-gradient-to-br from-blue-50 to-purple-50">
                  <Archive className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Unified Repository</h3>
                  <p className="text-slate-700 leading-relaxed">
                    We maintain a centralized repository that enables seamless access to harmonized datasets 
                    from multiple space agencies.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-md bg-gradient-to-br from-blue-50 to-purple-50">
                  <BarChart3 className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Visualization & Insights</h3>
                  <p className="text-slate-700 leading-relaxed">
                    We provide powerful visualization tools and AI-driven insights to help researchers 
                    discover patterns and relationships in astronomical data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  )
}
