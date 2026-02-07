import React from 'react';
import { Shield, Award, Users, Clock, CheckCircle, Truck } from 'lucide-react';

export default function TrustIndicators() {
  const features = [
    {
      icon: Shield,
      title: 'Verified Equipment',
      description: 'All equipment professionally inspected and authenticated before auction',
      color: 'text-blue-600'
    },
    {
      icon: Award,
      title: 'Licensed Dealers',
      description: 'Work with certified equipment dealers and trusted consigners',
      color: 'text-green-600'
    },
    {
      icon: Users,
      title: 'Professional Network',
      description: 'Connect with construction and agricultural professionals nationwide',
      color: 'text-purple-600'
    },
    {
      icon: Clock,
      title: 'Scheduled Auctions',
      description: 'Plan ahead with our announced live auction dates and times',
      color: 'text-orange-600'
    },
    {
      icon: CheckCircle,
      title: 'Clear Titles',
      description: 'All equipment and real estate sold with clear, transferable titles',
      color: 'text-teal-600'
    },
    {
      icon: Truck,
      title: 'Logistics Support',
      description: 'Transportation and delivery coordination for winning bidders',
      color: 'text-red-600'
    }
  ];

  const stats = [
    { value: 'New', label: 'Professional Platform' },
    { value: 'Licensed', label: 'Certified Auctioneers' },
    { value: 'Secure', label: 'Trusted Bidding' },
    { value: 'Coming', label: 'Soon' }
  ];

  return (
    <section className="py-16 bg-ironbound-grey-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trust Features */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">
            Why Choose IronBound Auctions?
          </h2>
          <p className="text-lg text-ironbound-grey-200 max-w-2xl mx-auto">
            We're the trusted platform for heavy equipment, agricultural machinery, 
            trucks, and real estate auctions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="text-center p-6 rounded-xl bg-ironbound-grey-600 hover:bg-ironbound-grey-700 transition-colors">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-ironbound-grey-700 mb-4`}>
                  <IconComponent className={`h-8 w-8 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-ironbound-grey-200">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="bg-gradient-to-r from-ironbound-grey-900 to-ironbound-grey-800 rounded-2xl p-8 lg:p-12">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">
              Trusted by IronBound Auctions
            </h3>
            <p className="text-ironbound-grey-300">
              Join thousands of contractors, farmers, and dealers who trust IronBound Auctions
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-ironbound-orange-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-ironbound-grey-300 text-sm lg:text-base">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <div className="bg-ironbound-grey-700 rounded-xl p-8">
            <h3 className="text-2xl font-bold text-white mb-4">
              Ready to Start Bidding?
            </h3>
            <p className="text-ironbound-grey-200 mb-6 max-w-2xl mx-auto">
              Register for free to participate in our scheduled live auctions. 
              No hidden fees, transparent bidding, and professional support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-md">
                Register to Bid
              </button>
              <button className="border-2 border-ironbound-orange-500 text-ironbound-orange-500 hover:bg-ironbound-orange-500 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                Consign Equipment
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}