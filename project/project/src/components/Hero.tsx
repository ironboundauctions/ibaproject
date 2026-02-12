import React from 'react';
import { Calendar, MapPin, Gavel, ArrowRight } from 'lucide-react';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative bg-gradient-to-br from-ironbound-grey-700 via-ironbound-grey-600 to-ironbound-grey-700 text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-ironbound-orange-500/20 to-transparent"></div>
        <svg className="absolute bottom-0 left-0 w-full h-64" viewBox="0 0 1200 120" fill="none">
          <path d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" fill="currentColor" fillOpacity="0.1"/>
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-8">
            {/* Announcement Banner */}
            <div className="inline-flex items-center space-x-2 bg-ironbound-orange-500/20 border border-ironbound-orange-500/30 rounded-full px-4 py-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-ironbound-orange-400" />
              <span className="text-ironbound-orange-300">PROFESSIONAL AUCTIONS</span>
              <span className="text-white">•</span>
              <span className="text-white">Coming Soon</span>
            </div>

            <div>
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-6 text-white">
                Professional
                <span className="block text-ironbound-orange-400">Equipment Auctions</span>
              </h1>
              <p className="text-xl text-ironbound-grey-100 leading-relaxed max-w-2xl">
                Discover premium construction equipment, agricultural machinery, semi-trucks, 
                and commercial vehicles through our licensed auction platform.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onGetStarted}
                className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
              >
                <span>Browse All Events</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="border-2 border-white/30 hover:border-ironbound-orange-400 hover:bg-ironbound-orange-400/10 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300">
                Register to Bid
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center space-x-8 pt-8 border-t border-ironbound-grey-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-ironbound-orange-400">New</div>
                <div className="text-sm text-ironbound-grey-400">Platform</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-ironbound-orange-400">Pro</div>
                <div className="text-sm text-ironbound-grey-400">Licensed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-ironbound-orange-400">Secure</div>
                <div className="text-sm text-ironbound-grey-400">Platform</div>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="relative z-10 space-y-4">
              <img
                src="/ChatGPT Image Dec 2, 2025, 09_12_26 AM.png"
                alt="Website Under Construction"
                className="rounded-2xl shadow-2xl w-full h-96 lg:h-[500px] object-contain bg-ironbound-grey-800"
              />
              <a
                href="https://ironboundauctions.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-4 rounded-lg font-semibold text-center transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Visit Current IronboundAuctions.com Website
              </a>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-ironbound-orange-500/20 rounded-full blur-xl"></div>
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-ironbound-orange-500/10 rounded-full blur-2xl"></div>
          </div>
        </div>
      </div>
    </section>
  );
}