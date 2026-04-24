import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, CreditCard as Edit, Trash2, Eye, BarChart3, Users, Gavel, DollarSign, List, UserPlus, Shield, Package, User, Key, Mail, Lock, X, Globe, EyeOff, BookOpen, Info, Radio, Monitor, ScrollText } from 'lucide-react';
import { Auction } from '../types/auction';
import { AdminStats } from '../types/admin';
import { AdminService } from '../services/adminService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAuth } from '../hooks/useAuth';
import { isAdminUser, isMainAdmin, canManageAdmins, canManageRegularUsers, canAccessAdminPanel, AuthService, isSuperAdmin } from '../services/authService';
import { AuctionService } from '../services/auctionService';
import ConsignerManagement from './ConsignerManagement';
import GlobalInventoryManagement from './GlobalInventoryManagement';
import EventItemsPage from './EventItemsPage';
import AdminEventForm from './AdminEventForm';
import AdminLotForm from './AdminLotForm';
import LotsGrid from './LotsGrid';
import { AdminManagementPanel } from './AdminManagementPanel';
import { UserPromotionPanel } from './UserPromotionPanel';
import { RecentlyRemovedFiles } from './RecentlyRemovedFiles';
import { RecentlyRemovedItems } from './RecentlyRemovedItems';
import { OrphanedRecordsCleanup } from './OrphanedRecordsCleanup';
import { B2BucketCleanup } from './B2BucketCleanup';
import AuctionLogsModal from './AuctionLogsModal';

interface AdminPanelProps {
  onBack: () => void;
  auctions: Auction[];
  onAuctionsUpdate: (auctions: Auction[]) => void;
  adminView?: string;
  onAdminViewChange?: (view: string) => void;
  initialCatalogEventId?: string | null;
}

export default function AdminPanel({ onBack, auctions, onAuctionsUpdate, adminView = 'dashboard', onAdminViewChange, initialCatalogEventId }: AdminPanelProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(adminView);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedLot, setSelectedLot] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [managingEventInventory, setManagingEventInventory] = useState<{ id: string; title: string } | null>(() => {
    if (initialCatalogEventId) {
      const match = auctions.find(a => a.id === initialCatalogEventId);
      if (match) return { id: match.id, title: match.title };
    }
    return null;
  });
  const [localAuctions, setLocalAuctions] = useState<Auction[]>(auctions);
  const [logsModal, setLogsModal] = useState<{ id: string; title: string } | null>(null);

  // Check if current user is admin
  const isAdmin = user && isAdminUser(user);

  // Update active tab when adminView prop changes
  useEffect(() => {
    setActiveTab(adminView);
  }, [adminView]);

  // Restore catalog view from URL after auctions load (handles page refresh)
  useEffect(() => {
    if (initialCatalogEventId && !managingEventInventory && auctions.length > 0) {
      const match = auctions.find(a => a.id === initialCatalogEventId);
      if (match) {
        setManagingEventInventory({ id: match.id, title: match.title });
      }
    }
  }, [initialCatalogEventId, auctions]);

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

  const refreshAuctions = useCallback(async () => {
    try {
      const auctionsData = await AdminService.getAllAuctions();
      setLocalAuctions(auctionsData);
      onAuctionsUpdate(auctionsData);
    } catch (error) {
      console.error('Error fetching auctions for admin panel:', error);
    }
  }, []);

  useEffect(() => {
    refreshAuctions();
  }, []);

  const handleCreateEvent = async (eventData: any) => {
    try {
      await AdminService.createAuctionEvent(eventData);
      await refreshAuctions();
      handleTabChange('auctions');
    } catch (error) {
      console.error('Error creating auction event:', error);
      throw error;
    }
  };

  const handleUpdateEvent = async (eventData: any) => {
    if (!selectedAuction) return;

    try {
      await AdminService.updateAuctionEvent(selectedAuction.id, eventData);
      await refreshAuctions();
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
      await refreshAuctions();
    } catch (error) {
      console.error('Error deleting auction event:', error);
    }
  };

  const handlePublishToggle = async (auction: any) => {
    try {
      if (auction.status === 'published' || auction.status === 'active') {
        await AdminService.unpublishEvent(auction.id);
      } else {
        await AdminService.publishEvent(auction.id);
      }
      await refreshAuctions();
    } catch (error) {
      console.error('Error toggling publish status:', error);
    }
  };

  const handleCreateAuction = async (auctionData: any) => {
    try {
      await AuctionService.createAuction(auctionData);
      await refreshAuctions();
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
                activeTab === 'auctions' || activeTab === 'create-event' || activeTab === 'edit-event'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <Gavel className="h-4 w-4 inline mr-2" />
              Events
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
              Consignors
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
              onClick={() => handleTabChange('recently-removed')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'recently-removed'
                  ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                  : 'border-transparent text-white hover:text-ironbound-orange-300 hover:border-ironbound-orange-300'
              }`}
            >
              <Trash2 className="h-4 w-4 inline mr-2" />
              Recently Removed
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
                {localAuctions.slice(0, 5).map((auction) => (
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
                      onError={(e) => { e.currentTarget.src = 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2'; }}
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

        {/* Recently Removed Tab */}
        {activeTab === 'recently-removed' && (
          <div className="space-y-6">
            <RecentlyRemovedFiles />
            <RecentlyRemovedItems />

            <div>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white">Storage Cleanup</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Run these in order: first clean up the database, then clean up B2 to remove any physical files that no longer have a database record.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <span className="text-sm font-semibold text-gray-200">Database Records Cleanup</span>
                    <span className="text-xs text-gray-400">— remove orphaned rows from the database</span>
                  </div>
                  <OrphanedRecordsCleanup />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <span className="text-sm font-semibold text-gray-200">B2 Bucket Cleanup</span>
                    <span className="text-xs text-gray-400">— delete files from storage with no database record</span>
                  </div>
                  <B2BucketCleanup />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auctions Management Tab */}
        {activeTab === 'auctions' && managingEventInventory && (
          <EventItemsPage
            eventId={managingEventInventory.id}
            eventTitle={managingEventInventory.title}
            onBack={() => {
              setManagingEventInventory(null);
              window.history.pushState({}, '', '/admin/auctions');
            }}
          />
        )}

        {activeTab === 'auctions' && !managingEventInventory && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Events</h2>
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
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                        Lots
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
                    {localAuctions.map((auction) => (
                      <tr key={auction.id} className="hover:bg-ironbound-grey-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={auction.image_url}
                              alt={auction.title}
                              className="w-10 h-10 rounded-lg object-cover"
                              onError={(e) => { e.currentTarget.src = 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2'; }}
                            />
                            <div className="ml-4">
                              <span className="text-sm font-medium text-ironbound-grey-900">
                                {auction.title}
                              </span>
                              <div className="text-xs text-ironbound-grey-500 mt-0.5">
                                {auction.is_event ? 'Event' : 'Item'}
                                {auction.event_number && (
                                  <span className="ml-1 text-ironbound-grey-400">· #{auction.event_number}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-ironbound-grey-900">
                          {auction.is_event ? `${auction.total_lots || 0} lots` : 'Individual item'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            auction.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : auction.status === 'published'
                              ? 'bg-blue-100 text-blue-800'
                              : auction.status === 'completed'
                              ? 'bg-ironbound-grey-100 text-ironbound-grey-700'
                              : auction.status === 'cancelled'
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
                                window.history.pushState({}, '', `/admin/auctions/event/${auction.id}`);
                              }}
                              className="text-ironbound-grey-500 hover:text-ironbound-orange-600 transition-colors"
                              title="Open Catalog"
                            >
                              <BookOpen className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => window.open(`/clerk/${auction.id}`, '_blank', 'noopener,noreferrer')}
                              className="text-ironbound-grey-500 hover:text-green-600 transition-colors"
                              title="Live Clerk"
                            >
                              <Radio className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => window.open(`/projector/${auction.id}`, '_blank', 'noopener,noreferrer')}
                              className="text-ironbound-grey-500 hover:text-ironbound-orange-500 transition-colors"
                              title="Audience Projector"
                            >
                              <Monitor className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => window.open(`/auctioneer-projector/${auction.id}`, '_blank', 'noopener,noreferrer')}
                              className="text-ironbound-grey-500 hover:text-blue-500 transition-colors"
                              title="Auctioneer Projector"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="3" width="20" height="14" rx="2"/>
                                <line x1="8" y1="21" x2="16" y2="21"/>
                                <line x1="12" y1="17" x2="12" y2="21"/>
                                <line x1="9" y1="13" x2="11.5" y2="10.5" strokeWidth="1.5"/>
                                <line x1="11.5" y1="10.5" x2="15" y2="7" strokeWidth="1.5"/>
                                <line x1="13" y1="9" x2="16.5" y2="12.5" strokeWidth="1.5"/>
                                <line x1="14.5" y1="7.5" x2="16" y2="6" strokeWidth="1.5"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => setLogsModal({ id: auction.id, title: auction.title })}
                              className="text-ironbound-grey-500 hover:text-blue-600 transition-colors"
                              title="Auction Logs"
                            >
                              <ScrollText className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePublishToggle(auction)}
                              className={`transition-colors ${
                                auction.status === 'published' || auction.status === 'active'
                                  ? 'text-blue-600 hover:text-blue-900'
                                  : 'text-ironbound-grey-400 hover:text-blue-600'
                              }`}
                              title={auction.status === 'published' || auction.status === 'active' ? 'Unpublish Event' : 'Publish Event'}
                            >
                              {auction.status === 'published' || auction.status === 'active'
                                ? <EyeOff className="h-4 w-4" />
                                : <Globe className="h-4 w-4" />
                              }
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
                event={selectedAuction}
              />
            </div>
          </div>
        )}

      </div>

      {logsModal && (
        <AuctionLogsModal
          eventId={logsModal.id}
          eventTitle={logsModal.title}
          onClose={() => setLogsModal(null)}
        />
      )}
    </div>
  );
}