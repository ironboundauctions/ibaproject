import React from 'react';
import { Truck, Tractor, Building, Car, Cog, Home } from 'lucide-react';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';

interface FeaturedCategoriesProps {
  onCategorySelect: (category: string) => void;
}

export default function FeaturedCategories({ onCategorySelect }: FeaturedCategoriesProps) {
  const categoryData = [
    {
      name: EQUIPMENT_CATEGORIES[0],
      icon: Cog,
      color: 'bg-ironbound-orange-500',
      hoverColor: 'hover:bg-ironbound-orange-600',
      description: 'Excavators, bulldozers, loaders',
      count: 'Professional Equipment'
    },
    {
      name: EQUIPMENT_CATEGORIES[1],
      icon: Tractor,
      color: 'bg-ironbound-orange-500',
      hoverColor: 'hover:bg-ironbound-orange-600',
      description: 'Tractors, harvesters, implements',
      count: 'Farm Equipment'
    },
    {
      name: EQUIPMENT_CATEGORIES[2],
      icon: Truck,
      color: 'bg-ironbound-orange-500',
      hoverColor: 'hover:bg-ironbound-orange-600',
      description: 'Over-the-road trucks, trailers',
      count: 'Commercial Trucks'
    },
    {
      name: EQUIPMENT_CATEGORIES[3],
      icon: Car,
      color: 'bg-ironbound-orange-500',
      hoverColor: 'hover:bg-ironbound-orange-600',
      description: 'Pickup trucks, work vehicles',
      count: 'Work Vehicles'
    },
    {
      name: EQUIPMENT_CATEGORIES[4],
      icon: Cog,
      color: 'bg-ironbound-orange-500',
      hoverColor: 'hover:bg-ironbound-orange-600',
      description: 'Cranes, compactors, specialty',
      count: 'Heavy Machinery'
    },
    {
      name: EQUIPMENT_CATEGORIES[5],
      icon: Building,
      color: 'bg-ironbound-orange-500',
      hoverColor: 'hover:bg-ironbound-orange-600',
      description: 'Commercial, industrial properties',
      count: 'Real Estate'
    }
  ];

  return (
    <section className="py-16 bg-ironbound-grey-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Equipment Categories
          </h2>
          <p className="text-lg text-ironbound-grey-200 max-w-2xl mx-auto">
            Browse our extensive inventory of construction equipment, agricultural machinery, 
            trucks, and real estate from trusted consigners.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryData.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.name}
                onClick={() => onCategorySelect(category.name)}
                className={`${category.color} ${category.hoverColor} text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-left group`}
              >
                <div className="flex items-center justify-between mb-4">
                  <IconComponent className="h-8 w-8" />
                  <div className="text-right">
                    <div className="text-sm opacity-90">{category.count}</div>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-white transition-colors">
                  {category.name}
                </h3>
                <p className="text-sm opacity-90 group-hover:opacity-100 transition-opacity">
                  {category.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium">
                  <span>Browse Category</span>
                  <svg className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => onCategorySelect('')}
            className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-md"
          >
            View All Events
          </button>
        </div>
      </div>
    </section>
  );
}