"use client"

import Header from "@/components/cosmic/header"
import Footer from "@/components/cosmic/footer"
import Starfield from "@/components/cosmic/starfield"
import SectionReveal from "@/components/cosmic/section-reveal"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useViewportReveal } from "@/hooks/use-viewport-reveal"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 relative overflow-hidden">
      <Starfield />
      
      <Header />
      <div className="container mx-auto px-4 py-12 space-y-16 max-w-7xl relative z-10">
        {/* Hero Section */}
        <SectionReveal>
          <section className="text-center py-12 relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-3">
              <div className="w-96 h-96 bg-slate-400 rounded-full blur-3xl animate-soft-pulse"></div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 relative animate-float-gentle">
              About COSMIC Data Fusion
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto relative">
              We are dedicated to revolutionizing astronomical data processing through innovative 
              cloud-enabled solutions that unify datasets from multiple space agencies.
            </p>
          </section>
        </SectionReveal>

        {/* Mission Section */}
        <SectionReveal delay={100}>
          <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-100/50 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
            <div className="relative">
              <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
                Our Mission
              </h2>
              <p className="text-slate-700 leading-relaxed text-lg">
                To bridge the gap between fragmented astronomical datasets by providing a unified, 
                cloud-enabled platform that enables seamless data fusion, standardization, and analysis 
                across multiple space agencies and observatories. We aim to accelerate astronomical 
                research by eliminating data silos and enabling collaborative, AI-driven discoveries.
              </p>
            </div>
          </section>
        </SectionReveal>

        {/* Vision Section */}
        <SectionReveal delay={200}>
          <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-slate-100/50 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
            <div className="relative">
              <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse stagger-1"></span>
                Our Vision
              </h2>
              <p className="text-slate-700 leading-relaxed text-lg">
                To become the leading platform for astronomical data fusion, where researchers worldwide 
                can effortlessly access, combine, and analyze heterogeneous datasets from NASA, ESA, JAXA, 
                and other space agencies. We envision a future where data fragmentation is no longer a 
                barrier to groundbreaking astronomical discoveries.
              </p>
            </div>
          </section>
        </SectionReveal>

        {/* Team Section */}
        <SectionReveal delay={300}>
          <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Our Team</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Team Member 1 */}
              <Card className="border-slate-200 hover:shadow-lg transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] group">
                <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
                <CardContent className="pt-6 relative">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative animate-float-gentle">
                      <Avatar className="w-32 h-32 border-4 border-slate-200 shadow-md group-hover:border-slate-300 transition-colors duration-300">
                        <AvatarImage src="/akif.png" alt="Aqeef Khan" />
                        <AvatarFallback className="text-2xl bg-slate-100 text-slate-700">
                          AK
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-400 rounded-full opacity-60 animate-soft-pulse"></div>
                    </div>
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
              <Card className="border-slate-200 hover:shadow-lg transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] group">
                <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
                <CardContent className="pt-6 relative">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative animate-float-slow">
                      <Avatar className="w-32 h-32 border-4 border-slate-200 shadow-md group-hover:border-slate-300 transition-colors duration-300">
                        <AvatarImage src="/revathi.jpeg" alt="Revathi Lyju" />
                        <AvatarFallback className="text-2xl bg-slate-100 text-slate-700">
                          RL
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-400 rounded-full opacity-60 animate-soft-pulse stagger-1"></div>
                    </div>
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
        </SectionReveal>

        {/* Values Section */}
        <SectionReveal delay={400}>
          <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg hover:bg-slate-50 transition-all duration-300 border-l-4 border-slate-300 hover:border-slate-400 hover:scale-[1.02] group">
                <div className="absolute inset-0 border border-transparent group-hover:border-slate-200 rounded-lg transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-soft-pulse"></span>
                    Innovation
                  </h3>
                  <p className="text-slate-700">
                    We continuously push the boundaries of what's possible in astronomical data processing 
                    and cloud computing.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-lg hover:bg-slate-50 transition-all duration-300 border-l-4 border-slate-300 hover:border-slate-400 hover:scale-[1.02] group stagger-1">
                <div className="absolute inset-0 border border-transparent group-hover:border-slate-200 rounded-lg transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-soft-pulse stagger-1"></span>
                    Collaboration
                  </h3>
                  <p className="text-slate-700">
                    We believe in the power of open science and collaborative research to drive 
                    astronomical discoveries.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-lg hover:bg-slate-50 transition-all duration-300 border-l-4 border-slate-300 hover:border-slate-400 hover:scale-[1.02] group stagger-2">
                <div className="absolute inset-0 border border-transparent group-hover:border-slate-200 rounded-lg transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-soft-pulse stagger-2"></span>
                    Accuracy
                  </h3>
                  <p className="text-slate-700">
                    Scientific integrity and data accuracy are at the core of everything we do.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-lg hover:bg-slate-50 transition-all duration-300 border-l-4 border-slate-300 hover:border-slate-400 hover:scale-[1.02] group stagger-3">
                <div className="absolute inset-0 border border-transparent group-hover:border-slate-200 rounded-lg transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-soft-pulse stagger-3"></span>
                    Accessibility
                  </h3>
                  <p className="text-slate-700">
                    We strive to make advanced astronomical data processing accessible to researchers 
                    worldwide.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </SectionReveal>

        {/* What We Do Section */}
        <SectionReveal delay={500}>
          <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-slate-100/30 to-transparent rounded-full blur-3xl opacity-30 animate-soft-pulse"></div>
            <div className="relative">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">What We Do</h2>
              <div className="space-y-6">
                <div className="p-5 rounded-lg hover:bg-slate-50 transition-all duration-300 hover:translate-x-2 border border-transparent hover:border-slate-200 group relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg"></div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
                    Data Ingestion & Standardization
                  </h3>
                  <p className="text-slate-700 ml-4">
                    We automatically ingest and standardize heterogeneous astronomical datasets from multiple 
                    sources, converting them into a unified canonical schema.
                  </p>
                </div>
                <div className="p-5 rounded-lg hover:bg-slate-50 transition-all duration-300 hover:translate-x-2 border border-transparent hover:border-slate-200 group relative stagger-1">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg"></div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse stagger-1"></span>
                    Cloud-Enabled Processing
                  </h3>
                  <p className="text-slate-700 ml-4">
                    Our platform leverages cloud computing to handle large-scale astronomical data processing 
                    efficiently and cost-effectively.
                  </p>
                </div>
                <div className="p-5 rounded-lg hover:bg-slate-50 transition-all duration-300 hover:translate-x-2 border border-transparent hover:border-slate-200 group relative stagger-2">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg"></div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse stagger-2"></span>
                    Unified Repository
                  </h3>
                  <p className="text-slate-700 ml-4">
                    We maintain a centralized repository that enables seamless access to harmonized datasets 
                    from multiple space agencies.
                  </p>
                </div>
                <div className="p-5 rounded-lg hover:bg-slate-50 transition-all duration-300 hover:translate-x-2 border border-transparent hover:border-slate-200 group relative stagger-3">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg"></div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse stagger-3"></span>
                    Visualization & Insights
                  </h3>
                  <p className="text-slate-700 ml-4">
                    We provide powerful visualization tools and AI-driven insights to help researchers 
                    discover patterns and relationships in astronomical data.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </SectionReveal>
      </div>
      <Footer />
    </main>
  )
}
