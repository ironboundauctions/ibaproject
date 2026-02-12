import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, Building, Mail, MapPin, Phone } from 'lucide-react';
import { Consigner } from '../types/consigner';
import { ConsignerService } from '../services/consignerService';
import ConsignerForm from './ConsignerForm';

interface ConsignerManagementProps {
  onConsignerSelect?: (consigner: Consigner) => void;
}

export default function ConsignerManagement({ onConsignerSelect }: ConsignerManagementProps) {
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [filteredConsigners, setFilteredConsigners] = useState<Consigner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedConsigner, setSelectedConsigner] = useState<Consigner | null>(null);

  useEffect(() => {
    const fetchConsigners = async () => {
      try {
        const consignersData = await ConsignerService.getConsigners();
        setConsigners(consignersData);
        setFilteredConsigners(consignersData);
      } catch (error) {
        console.error('Error fetching consigners:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsigners();
  }, []);

  useEffect(() => {
    const filtered = consigners.filter(consigner =>
      consigner.customer_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      consigner.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (consigner.company && consigner.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      consigner.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredConsigners(filtered);
  }, [consigners, searchQuery]);

  const handleCreateConsigner = () => {
    setSelectedConsigner(null);
    setShowForm(true);
  };

  const handleEditConsigner = (consigner: Consigner) => {
    setSelectedConsigner(consigner);
    setShowForm(true);
  };

  const handleDeleteConsigner = async (consigner: Consigner) => {
    if (!confirm(`Are you sure you want to delete consigner ${consigner.customer_number} (${consigner.full_name})?`)) {
      return;
    }

    try {
      await ConsignerService.deleteConsigner(consigner.id);
      setConsigners(prev => prev.filter(c => c.id !== consigner.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete consigner');
    }
  };

  const handleFormSubmit = async (consignerData: any) => {
    try {
      if (selectedConsigner) {
        const updatedConsigner = await ConsignerService.updateConsigner(selectedConsigner.id, consignerData);
        setConsigners(prev => prev.map(c => c.id === selectedConsigner.id ? updatedConsigner : c));
      } else {
        const newConsigner = await ConsignerService.createConsigner(consignerData);
        setConsigners(prev => [newConsigner, ...prev]);
      }
      setShowForm(false);
      setSelectedConsigner(null);
    } catch (error) {
      throw error; // Let the form handle the error display
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ironbound-orange-500 mx-auto mb-4"></div>
          <p className="text-ironbound-grey-500">Loading consigners...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <ConsignerForm
        consigner={selectedConsigner}
        onSubmit={handleFormSubmit}
        onCancel={() => {
          setShowForm(false);
          setSelectedConsigner(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Consigner Management</h2>
          <p className="text-ironbound-grey-200">Manage consigners and their information</p>
        </div>
        <button
          onClick={handleCreateConsigner}
          className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Consigner</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer number, name, company, or email..."
            className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Consigners List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredConsigners.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-ironbound-grey-400" />
            </div>
            <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-2">
              {searchQuery ? 'No consigners found' : 'No consigners yet'}
            </h3>
            <p className="text-ironbound-grey-600 mb-4">
              {searchQuery 
                ? 'Try adjusting your search criteria'
                : 'Start by adding your first consigner to the system'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateConsigner}
                className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Add First Consigner
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ironbound-grey-200">
              <thead className="bg-ironbound-grey-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Customer #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Consigner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ironbound-grey-200">
                {filteredConsigners.map((consigner) => (
                  <tr 
                    key={consigner.id} 
                    className="hover:bg-ironbound-grey-50 cursor-pointer"
                    onClick={() => onConsignerSelect?.(consigner)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-ironbound-orange-600">
                        {consigner.customer_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="bg-ironbound-orange-100 p-2 rounded-full mr-3">
                          <User className="h-4 w-4 text-ironbound-orange-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-ironbound-grey-900">
                            {consigner.full_name}
                            {consigner.nickname && (
                              <span className="text-ironbound-orange-600 ml-2">"{consigner.nickname}"</span>
                            )}
                          </div>
                          {consigner.company && (
                            <div className="text-sm text-ironbound-grey-500 flex items-center">
                              <Building className="h-3 w-3 mr-1" />
                              {consigner.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-ironbound-grey-900 flex items-center mb-1">
                        <Mail className="h-3 w-3 mr-1 text-ironbound-grey-400" />
                        {consigner.email || 'No email'}
                      </div>
                      {consigner.phone && (
                        <div className="text-sm text-ironbound-grey-500 flex items-center mb-1">
                          <Phone className="h-3 w-3 mr-1 text-ironbound-grey-400" />
                          {consigner.phone}
                        </div>
                      )}
                      <div className="text-sm text-ironbound-grey-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1 text-ironbound-grey-400" />
                        {consigner.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm">
                        <span className="text-ironbound-grey-400 mr-1">#</span>
                        <span className="font-medium text-ironbound-grey-900">{consigner.active_items}</span>
                        <span className="text-ironbound-grey-500 mx-1">/</span>
                        <span className="text-ironbound-grey-500">{consigner.total_items}</span>
                      </div>
                      <div className="text-xs text-ironbound-grey-500">Active / Total</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ironbound-grey-500">
                      {new Date(consigner.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditConsigner(consigner);
                          }}
                          className="text-ironbound-orange-600 hover:text-ironbound-orange-900 transition-colors p-1"
                          title="Edit Consigner"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConsigner(consigner);
                          }}
                          className="text-red-600 hover:text-red-900 transition-colors p-1"
                          title="Delete Consigner"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}