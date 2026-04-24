import React, { useState, useEffect } from 'react';
import { Plus, Search, CreditCard as Edit, Trash2, User, Building, Mail, MapPin, Phone } from 'lucide-react';
import { Consignor } from '../types/consigner';
import { ConsignorService } from '../services/consignerService';
import ConsignorForm from './ConsignerForm';
import ConfirmDialog from './ConfirmDialog';

interface ConsignorManagementProps {
  onConsignorSelect?: (consignor: Consignor) => void;
}

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'info' | 'success' | 'restore';
  alertOnly?: boolean;
  onConfirm: () => void;
}

export default function ConsignorManagement({ onConsignorSelect }: ConsignorManagementProps) {
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [filteredConsignors, setFilteredConsignors] = useState<Consignor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedConsignor, setSelectedConsignor] = useState<Consignor | null>(null);
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false, title: '', message: '', confirmLabel: 'OK', variant: 'danger', onConfirm: () => {},
  });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));
  const openDialog = (opts: Omit<DialogState, 'isOpen'>) => setDialog({ ...opts, isOpen: true });

  useEffect(() => {
    const fetchConsignors = async () => {
      try {
        const consignorsData = await ConsignorService.getConsignors();
        setConsignors(consignorsData);
        setFilteredConsignors(consignorsData);
      } catch (error) {
        console.error('Error fetching consignors:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsignors();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = consignors.filter(consignor =>
      consignor.customer_number?.toLowerCase().includes(q) ||
      consignor.full_name?.toLowerCase().includes(q) ||
      consignor.nickname?.toLowerCase().includes(q) ||
      consignor.company?.toLowerCase().includes(q) ||
      consignor.email?.toLowerCase().includes(q) ||
      consignor.phone?.toLowerCase().includes(q) ||
      consignor.address?.toLowerCase().includes(q)
    );
    setFilteredConsignors(filtered);
  }, [consignors, searchQuery]);

  const handleCreateConsignor = () => {
    setSelectedConsignor(null);
    setShowForm(true);
  };

  const handleEditConsignor = (consignor: Consignor) => {
    setSelectedConsignor(consignor);
    setShowForm(true);
  };

  const handleDeleteConsignor = (consignor: Consignor) => {
    openDialog({
      title: 'Delete Consignor',
      message: `Are you sure you want to delete consignor ${consignor.customer_number} (${consignor.full_name})?`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        closeDialog();
        try {
          await ConsignorService.deleteConsignor(consignor.id);
          setConsignors(prev => prev.filter(c => c.id !== consignor.id));
        } catch (error) {
          openDialog({
            title: 'Error',
            message: error instanceof Error ? error.message : 'Failed to delete consignor',
            confirmLabel: 'OK',
            variant: 'danger',
            alertOnly: true,
            onConfirm: closeDialog,
          });
        }
      },
    });
  };

  const handleFormSubmit = async (consignorData: any) => {
    try {
      if (selectedConsignor) {
        const updatedConsignor = await ConsignorService.updateConsignor(selectedConsignor.id, consignorData);
        setConsignors(prev => prev.map(c => c.id === selectedConsignor.id ? updatedConsignor : c));
      } else {
        const newConsignor = await ConsignorService.createConsignor(consignorData);
        setConsignors(prev => [newConsignor, ...prev]);
      }
      setShowForm(false);
      setSelectedConsignor(null);
    } catch (error) {
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ironbound-orange-500 mx-auto mb-4"></div>
          <p className="text-ironbound-grey-500">Loading consignors...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <ConsignorForm
        consignor={selectedConsignor}
        onSubmit={handleFormSubmit}
        onCancel={() => {
          setShowForm(false);
          setSelectedConsignor(null);
        }}
      />
    );
  }

  return (
    <>
    <ConfirmDialog
      isOpen={dialog.isOpen}
      title={dialog.title}
      message={dialog.message}
      confirmLabel={dialog.confirmLabel}
      variant={dialog.variant}
      alertOnly={dialog.alertOnly}
      onConfirm={dialog.onConfirm}
      onCancel={closeDialog}
    />
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Consignor Management</h2>
          <p className="text-ironbound-grey-200">Manage consignors and their information</p>
        </div>
        <button
          onClick={handleCreateConsignor}
          className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Consignor</span>
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
            className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 placeholder-gray-400 bg-white"
          />
        </div>
      </div>

      {/* Consignors List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredConsignors.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-ironbound-grey-400" />
            </div>
            <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-2">
              {searchQuery ? 'No consignors found' : 'No consignors yet'}
            </h3>
            <p className="text-ironbound-grey-600 mb-4">
              {searchQuery
                ? 'Try adjusting your search criteria'
                : 'Start by adding your first consignor to the system'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateConsignor}
                className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Add First Consignor
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
                    Consignor
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
                {filteredConsignors.map((consignor) => (
                  <tr
                    key={consignor.id}
                    className="hover:bg-ironbound-grey-50 cursor-pointer"
                    onClick={() => onConsignorSelect?.(consignor)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-ironbound-orange-600">
                        {consignor.customer_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="bg-ironbound-orange-100 p-2 rounded-full mr-3">
                          <User className="h-4 w-4 text-ironbound-orange-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-ironbound-grey-900">
                            {consignor.full_name}
                            {consignor.nickname && (
                              <span className="text-ironbound-orange-600 ml-2">"{consignor.nickname}"</span>
                            )}
                          </div>
                          {consignor.company && (
                            <div className="text-sm text-ironbound-grey-500 flex items-center">
                              <Building className="h-3 w-3 mr-1" />
                              {consignor.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-ironbound-grey-900 flex items-center mb-1">
                        <Mail className="h-3 w-3 mr-1 text-ironbound-grey-400" />
                        {consignor.email || 'No email'}
                      </div>
                      {consignor.phone && (
                        <div className="text-sm text-ironbound-grey-500 flex items-center mb-1">
                          <Phone className="h-3 w-3 mr-1 text-ironbound-grey-400" />
                          {consignor.phone}
                        </div>
                      )}
                      <div className="text-sm text-ironbound-grey-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1 text-ironbound-grey-400" />
                        {consignor.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm">
                        <span className="text-ironbound-grey-400 mr-1">#</span>
                        <span className="font-medium text-ironbound-grey-900">{consignor.active_items}</span>
                        <span className="text-ironbound-grey-500 mx-1">/</span>
                        <span className="text-ironbound-grey-500">{consignor.total_items}</span>
                      </div>
                      <div className="text-xs text-ironbound-grey-500">Active / Total</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ironbound-grey-500">
                      {new Date(consignor.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditConsignor(consignor);
                          }}
                          className="text-ironbound-orange-600 hover:text-ironbound-orange-900 transition-colors p-1"
                          title="Edit Consignor"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConsignor(consignor);
                          }}
                          className="text-red-600 hover:text-red-900 transition-colors p-1"
                          title="Delete Consignor"
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
    </>
  );
}
