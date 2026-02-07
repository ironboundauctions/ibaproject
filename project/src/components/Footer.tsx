import React from 'react';
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-ironbound-grey-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/ironbound_primarylogog.png" 
                alt="IronBound Auctions" 
                className="h-12 w-auto brightness-0 invert"
              />
              <div>
                <h3 className="text-xl font-bold">IronBound Auctions</h3>
                <p className="text-ironbound-grey-400 text-sm">Premium Online Auctions</p>
              </div>
            </div>
            <p className="text-ironbound-grey-300 mb-6 max-w-md">
              Professional equipment auctions featuring construction machinery, agricultural equipment, 
              semi-trucks, and commercial vehicles through our secure, licensed auction platform.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-ironbound-grey-400 hover:text-ironbound-orange-500 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-ironbound-grey-400 hover:text-ironbound-orange-500 transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-ironbound-grey-400 hover:text-ironbound-orange-500 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-ironbound-grey-400 hover:text-ironbound-orange-500 transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-ironbound-grey-300 hover:text-ironbound-orange-500 transition-colors">Browse Auctions</a></li>
              <li><a href="#" className="text-ironbound-grey-300 hover:text-ironbound-orange-500 transition-colors">How It Works</a></li>
              <li><a href="#" className="text-ironbound-grey-300 hover:text-ironbound-orange-500 transition-colors">Seller Guide</a></li>
              <li><a href="#" className="text-ironbound-grey-300 hover:text-ironbound-orange-500 transition-colors">Buyer Protection</a></li>
              <li><a href="#" className="text-ironbound-grey-300 hover:text-ironbound-orange-500 transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-ironbound-orange-500" />
                <span className="text-ironbound-grey-300">info@ironboundauctions.com</span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-ironbound-orange-500" />
                <span className="text-ironbound-grey-300">(432) 209-5112</span>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-4 w-4 text-ironbound-orange-500" />
                <span className="text-ironbound-grey-300">(432) 209-5112</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-ironbound-grey-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-ironbound-grey-400 text-sm">
            © 2024 IronBound Auctions. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-ironbound-grey-400 hover:text-ironbound-orange-500 text-sm transition-colors">Privacy Policy</a>
            <a href="#" className="text-ironbound-grey-400 hover:text-ironbound-orange-500 text-sm transition-colors">Terms of Service</a>
            <a href="#" className="text-ironbound-grey-400 hover:text-ironbound-orange-500 text-sm transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}