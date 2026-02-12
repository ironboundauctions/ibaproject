import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, CreditCard as Edit, Trash2, Eye, BarChart3, Users, Gavel, DollarSign, List, UserPlus, Shield, Package, User, Key, Mail, Lock, X } from 'lucide-react';
import { Auction } from '../types/auction';
import { AdminStats } from '../types/admin';
import { AdminService } from '../services/adminService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAuth } from '../hooks/useAuth';
import { isAdminUser, isMainAdmin, canManageAdmins, canManageRegularUsers, canAccessAdminPanel, AuthService, isSuperAdmin } from '../services/authService';
import { AuctionService } from '../services/auctionService';
import ConsignerManagement from './ConsignerManagement';
import GlobalInventoryManagement from './GlobalInventoryManagement';
import EventInventoryManager from './EventInventoryManager';
import AdminEventForm from './AdminEventForm';
import AdminLotForm from './AdminLotForm';
import LotsGrid from './LotsGrid';
import CreateAuctionModal from './CreateAuctionModal';
import IronDriveConnectionTest from './IronDriveConnectionTest';
import { AdminManagementPanel } from './AdminManagementPanel';
import { UserPromotionPanel } from './UserPromotionPanel';
import OrphanedFilesCheckerUI from './OrphanedFilesChecker';

interface AdminPanelProps {
  onBack: () => void;
  auctions: Auction[];
  onAuctionsUpdate: (auctions: Auction[]) => void;
  adminView?: string;
  onAdminViewChange?: (view: string) => void;
}

export default function AdminPanel({ onBack, auctions, onAuctionsUpdate, adminView = 'dashboard', onAdminViewChange }: AdminPanelProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(adminView);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedLot, setSelectedLot] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [managingEventInventory, setManagingEventInventory] = useState<{ id: string; title: string } | null>(null);

  // Check if current user is admin
  const isAdmin = user && isAdminUser(user);

  // Update active tab when adminView prop changes
  useEffect(() => {
    setActiveTab(adminView);
  }, [adminView]);

  // Handle tab changes with URL updates
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onAdminViewChange) {
      onAdminViewChange(tab);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, adminUsersData] = await Promise.all([
          AdminService.getAdminStats(),
          AuthService.getAllAdminUsers()
        ]);
        setStats(statsData);
        setAdminUsers(adminUsersData);
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch auctions/events on component mount
  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const auctionsData = await AdminService.getAllAuctions();
        onAuctionsUpdate(auctionsData);
      } catch (error) {
        console.error('Error fetching auctions for admin panel:', error);
      }
    };

    fetchAuctions();
  }, [onAuctionsUpdate]);

  const handleCreateEvent = async (eventData: any) => {
    try {
      console.log('Creating new event:', eventData.title);
      const newAuction = await AdminService.createAuctionEvent(eventData);
      console.log('Event created successfully:', newAuction.id);
      const updatedAuctions = [newAuction, ...auctions];
      onAuctionsUpdate(updatedAuctions);
      
      // Force a refresh of the auctions list
      setTimeout(async () => {
        console.log('Refreshing auctions list...');
        const refreshedAuctions = await AdminService.getAllAuctions();
        console.log('Refreshed auctions count:', refreshedAuctions.length);
        onAuctionsUpdate(refreshedAuctions);
      }, 100);
      
      handleTabChange('auctions');
    } catch (error) {
      console.error('Error creating auction event:', error);
      throw error;
    }
  };

  const handleUpdateEvent = async (eventData: any) => {
    if (!selectedAuction) return;
    
    try {
      const updatedAuction = await AdminService.updateAuctionEvent(selectedAuction.id, eventData);
      onAuctionsUpdate(auctions.map(a => a.id === selectedAuction.id ? updatedAuction : a));
      handleTabChange('auctions');
      setSelectedAuction(null);
    } catch (error) {
      console.error('Error updating auction event:', error);
      throw error;
    }
  };

  const handleCreateLot = async (lotData: any) => {
    if (!selectedAuction) return;
    
    try {
      await AdminService.addLotToAuction(selectedAuction.id, lotData);
      // Refresh auction data
      // In a real app, you'd refresh from the server
      handleTabChange('manage-lots');
    } catch (error) {
      console.error('Error creating lot:', error);
      throw error;
    }
  };

  const handleDeleteAuction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this auction event and all its lots?')) return;
    
    try {
      await AdminService.deleteAuctionEvent(id);
      onAuctionsUpdate(auctions.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting auction event:', error);
    }
  };

  const handleCreateAuction = async (auctionData: any) => {
    try {
      const newAuction = await AuctionService.createAuction(auctionData);
      onAuctionsUpdate([newAuction, ...auctions]);
      handleTabChange('auctions');
    } catch (error) {
      console.error('Error creating auction:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ironbound-grey-500 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ironbound-orange-500 mx-auto mb-4"></div>
          <p className="text-ironbound-grey-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ironbound-grey-500 text-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-ironbound-grey-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-ironbound-grey-600 hover:text-ironbound-orange-500 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Site</span>
            </button>
            <div className="flex items-center space-x-3">
              <img 
                src="/ironbound_primarylogog.png" 
                alt="IronBound Auctions" 
                className="h-8 w-auto"
              />
              <h1 className="text-2xl font-bold text-ironbound-grey-900">Admin Panel</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => handleTabChange('auctions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'auctions'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <Gavel className="h-4 w-4 inline mr-2" />
              Events & Items
            </button>
            <button
              onClick={() => handleTabChange('consigners')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'consigners'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Consigners
            </button>
            <button
              onClick={() => handleTabChange('create-event')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'create-event'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <Plus className="h-4 w-4 inline mr-2" />
              Create Event
            </button>
            <button
              onClick={() => handleTabChange('inventory')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'inventory'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <Package className="h-4 w-4 inline mr-2" />
              Inventory
            </button>
            <button
              onClick={() => handleTabChange('user-management')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'user-management'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              User Management
            </button>
            {isSuperAdmin(user) && (
              <button
                onClick={() => handleTabChange('admin-management')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'admin-management'
                    ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                    : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
                }`}
              >
                <Shield className="h-4 w-4 inline mr-2" />
                Admin Management
              </button>
            )}
            <button
              onClick={() => handleTabChange('irondrive-settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'irondrive-settings'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <Package className="h-4 w-4 inline mr-2" />
              IronDrive
            </button>
          </nav>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Data Management */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Data Management</h3>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    const data = {
                      events: localStorage.getItem('ironbound_auction_events'),
                      users: localStorage.getItem('ironbound_all_users'),
                      admin: localStorage.getItem('ironbound_admin_exists'),
                      currentUser: localStorage.getItem('ironbound_current_user')
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ironbound-backup-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Export Data
                </button>
                <label className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer">
                  Import Data
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const data = JSON.parse(event.target?.result as string);
                            if (data.events) localStorage.setItem('ironbound_auction_events', data.events);
                            if (data.users) localStorage.setItem('ironbound_all_users', data.users);
                            if (data.admin) localStorage.setItem('ironbound_admin_exists', data.admin);
                            if (data.currentUser) localStorage.setItem('ironbound_current_user', data.currentUser);
                            alert('Data imported successfully! Please refresh the page.');
                          } catch (error) {
                            alert('Error importing data: ' + error);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
                <button
                  onClick={() => {
                    console.log('=== CURRENT DATA STATE ===');
                    console.log('Events:', localStorage.getItem('ironbound_auction_events'));
                    console.log('Users:', localStorage.getItem('ironbound_all_users'));
                    console.log('Admin exists:', localStorage.getItem('ironbound_admin_exists'));
                    console.log('Current user:', localStorage.getItem('ironbound_current_user'));
                    console.log('========================');
                    alert('Check browser console for data state');
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Debug Data
                </button>
              </div>
              <p className="text-sm text-ironbound-grey-600 mt-2">
                Export your data to backup, import to restore, or debug to check current state.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center">
                  <div className="bg-ironbound-orange-100 p-3 rounded-lg">
                    <Gavel className="h-6 w-6 text-ironbound-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-ironbound-grey-900">{stats.total_auctions}</p>
                    <p className="text-sm text-ironbound-grey-600">Total Auctions</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center">
                  <div className="bg-ironbound-orange-100 p-3 rounded-lg">
                    <Eye className="h-6 w-6 text-ironbound-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-ironbound-grey-900">{stats.active_auctions}</p>
                    <p className="text-sm text-ironbound-grey-600">Active Auctions</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center">
                  <div className="bg-ironbound-orange-100 p-3 rounded-lg">
                    <Users className="h-6 w-6 text-ironbound-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-ironbound-grey-900">{stats.total_users}</p>
                    <p className="text-sm text-ironbound-grey-600">Registered Users</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center">
                  <div className="bg-ironbound-orange-100 p-3 rounded-lg">
                    <DollarSign className="h-6 w-6 text-ironbound-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-ironbound-grey-900">{formatCurrency(stats.revenue)}</p>
                    <p className="text-sm text-ironbound-grey-600">Total Revenue</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {auctions.slice(0, 5).map((auction) => (
                <div 
                  key={auction.id} 
                  className="flex items-center justify-between p-4 bg-ironbound-grey-50 rounded-lg hover:bg-ironbound-grey-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <Gavel className="h-4 w-4 text-ironbound-orange-500" />
                    <img
                      src={auction.image_url}
                      alt={auction.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <p className="font-medium text-ironbound-grey-900">{auction.title}</p>
                      <p className="text-sm text-ironbound-grey-600">{auction.is_event ? 'Event' : 'Item'} • {auction.lot_number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-ironbound-grey-900">{auction.is_event ? 'Event' : 'Item'}</p>
                    <p className="text-sm text-ironbound-grey-600">{auction.is_event ? 'Multi-lot event' : auction.category}</p>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        )}

        {/* Consigners Tab */}
        {activeTab === 'consigners' && (
          <ConsignerManagement />
        )}

        {/* Inventory Management Tab */}
        {activeTab === 'inventory' && (
          <GlobalInventoryManagement />
        )}

        {/* Auctions Management Tab */}
        {activeTab === 'auctions' && managingEventInventory && (
          <EventInventoryManager
            eventId={managingEventInventory.id}
            eventTitle={managingEventInventory.title}
            onBack={() => setManagingEventInventory(null)}
          />
        )}

        {activeTab === 'auctions' && !managingEventInventory && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Events & Items</h2>
              <button
                onClick={() => handleTabChange('create-event')}
                className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Event</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ironbound-grey-200">
                  <thead className="bg-ironbound-grey-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                        Event/Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                        Lots
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                        Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-ironbound-grey-200">
                    {auctions.map((auction) => (
                      <tr key={auction.id} className="hover:bg-ironbound-grey-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={auction.image_url}
                              alt={auction.title}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                            <div className="ml-4">
                              <div className="text-sm font-medium text-ironbound-grey-900">
                                {auction.title}
                              </div>
                              <div className="text-sm text-ironbound-grey-500">
                                {auction.is_event ? 'Event' : 'Item'} • {auction.lot_number}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-ironbound-grey-900">
                          {auction.is_event ? `${auction.total_lots || 0} lots` : 'Individual item'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-ironbound-grey-900">
                          {auction.is_event ? `${auction.registered_bidders || 0} registered` : `${auction.bid_count || 0} bids • ${formatCurrency(auction.current_bid || auction.starting_price)}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            auction.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : auction.status === 'ended'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {auction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-ironbound-grey-900">
                          {formatDate(auction.start_date || auction.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setManagingEventInventory({ id: auction.id, title: auction.title });
                              }}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                              title="Manage Items"
                            >
                              <Package className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAuction(auction);
                                handleTabChange('edit-event');
                              }}
                              className="text-ironbound-orange-600 hover:text-ironbound-orange-900 transition-colors"
                              title="Edit Event"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAuction(auction.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Delete Event"
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
            </div>
          </div>
        )}

        {/* User Management Tab - Promote regular users */}
        {activeTab === 'user-management' && isSuperAdmin(user) && (
          <UserPromotionPanel />
        )}

        {/* Admin Management Tab */}
        {activeTab === 'admin-management' && isSuperAdmin(user) && user && (
          <AdminManagementPanel currentUserId={user.id} />
        )}

        {/* Create Event Tab */}
        {activeTab === 'create-event' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Create New Auction Event</h2>
              <p className="text-ironbound-grey-200">Set up a multi-lot auction event</p>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
              <AdminEventForm
                onSubmit={handleCreateEvent}
                onCancel={() => handleTabChange('auctions')}
              />
            </div>
          </div>
        )}

        {/* Edit Event Tab */}
        {activeTab === 'edit-event' && selectedAuction && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Edit Auction Event</h2>
              <p className="text-ironbound-grey-200">Update event information</p>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
              <AdminEventForm
                onSubmit={handleUpdateEvent}
                onCancel={() => {
                  handleTabChange('auctions');
                  setSelectedAuction(null);
                }}
                initialData={selectedAuction}
              />
            </div>
          </div>
        )}

        {/* IronDrive Settings Tab */}
        {activeTab === 'irondrive-settings' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">IronDrive File Server</h2>
              <p className="text-ironbound-grey-200">Configure connection to your RAID file server</p>
            </div>
            
            <IronDriveConnectionTest />

            <OrphanedFilesCheckerUI />

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Integration Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-ironbound-grey-900 mb-2">IronDrive Authentication</h4>
                  <div className="space-y-2 text-sm text-ironbound-grey-600">
                    <p><strong>Username:</strong> ibaproject.bid@outlook.com</p>
                    <p><strong>Password:</strong> ••••••••</p>
                    <p><strong>Method:</strong> JWT Bearer Token</p>
                    <p><strong>Endpoint:</strong> /ecommerce-auth</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-ironbound-grey-900 mb-2">File Organization</h4>
                  <div className="space-y-2 text-sm text-ironbound-grey-600">
                    <p><strong>Storage:</strong> Your RAID server via IronDrive</p>
                    <p><strong>Naming:</strong> inventory-number-main.jpg, inventory-number-img2.jpg</p>
                    <p><strong>Organization:</strong> Files grouped by inventory number</p>
                    <p><strong>Access:</strong> Direct URLs from your RAID server</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}