import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import FeaturedCategories from './components/FeaturedCategories';
import TrustIndicators from './components/TrustIndicators';
import AuctionFilters from './components/AuctionFilters';
import AuctionGrid from './components/AuctionGrid';
import AuctionDetail from './components/AuctionDetail';
import AuthModal from './components/AuthModal';
import CreateAuctionModal from './components/CreateAuctionModal';
import UserProfile from './components/UserProfile';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import AuthProvider from './components/AuthProvider';
import PasswordReset from './components/PasswordReset';
import { useAuth } from './hooks/useAuth';
import { Auction } from './types/auction';
import { AuctionService } from './services/auctionService';
import { AdminService } from './services/adminService';
import { isAdminUser, AuthService } from './services/authService';
import { IronDriveService } from './services/ironDriveService';

type View = 'home' | 'auctions' | 'auction-detail' | 'profile' | 'admin' | 'password-reset';

type AdminView = 'dashboard' | 'auctions' | 'create-event' | 'edit-event' | 'manage-lots' | 'create-lot' | 'edit-lot' | 'user-management' | 'admin-management' | 'create-admin' | 'create-auction' | 'consigners' | 'inventory' | 'admin-recovery';

function AppContent() {
  const { user, isInitialized } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [filteredAuctions, setFilteredAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('ending_soon');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [showFilters, setShowFilters] = useState(false);
  const [raidBannerVisible, setRaidBannerVisible] = useState(false);
  const [raidBannerMessage, setRaidBannerMessage] = useState('');

  const isAdmin = isAdminUser(user);

  useEffect(() => {
    const checkRaidHealth = async () => {
      try {
        const health = await IronDriveService.checkHealth();
        if (!health.raidAvailable) {
          setRaidBannerVisible(true);
          setRaidBannerMessage(health.message);
        } else {
          setRaidBannerVisible(false);
        }
      } catch (error) {
        console.error('RAID health check error:', error);
        // Don't show banner for health check errors, just log them
      }
    };

    checkRaidHealth();

    const interval = setInterval(checkRaidHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('App: Current state:', {
      isInitialized,
      user: user ? `${user.email || 'no-email'} (${user.role || 'no-role'})` : 'no user',
      userValid: user ? !!(user.email && user.name && user.role) : 'n/a',
      currentView
    });
  }, [isInitialized, user]);

  // Handle URL-based routing
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;

      if (path === '/reset-password' || hash === '#reset-password') {
        setCurrentView('password-reset');
      } else if (path.startsWith('/admin')) {
        if (isAdminUser(user)) {
          setCurrentView('admin');
          // Parse admin sub-routes
          const adminPath = path.replace('/admin', '') || '/dashboard';
          const adminRoute = adminPath.substring(1) || 'dashboard';
          
          const validAdminViews: AdminView[] = [
            'dashboard', 'auctions', 'create-event', 'edit-event', 'manage-lots', 
            'create-lot', 'edit-lot', 'user-management', 'admin-management', 
            'create-admin', 'create-auction', 'consigners', 'inventory', 'admin-recovery'
          ];
          
          if (validAdminViews.includes(adminRoute as AdminView)) {
            setAdminView(adminRoute as AdminView);
          } else {
            setAdminView('dashboard');
          }
        } else {
          setCurrentView('home');
        }
      } else if (hash === '#admin') {
        if (isAdminUser(user)) {
          setCurrentView('admin');
          setAdminView('dashboard');
        } else {
          setCurrentView('home');
        }
      } else if (path === '/profile' || hash === '#profile') {
        if (user) {
          setCurrentView('profile');
        } else {
          setCurrentView('home');
        }
      } else if (path === '/auctions' || hash === '#auctions') {
        setCurrentView('auctions');
      } else {
        setCurrentView('home');
      }
    };

    // Handle initial load - only after auth is initialized
    if (isInitialized) {
      handlePopState();
    }
    
    // Listen for browser back/forward
    window.addEventListener('popstate', handlePopState);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, isInitialized]);

  // Redirect to home when user logs out
  useEffect(() => {
    if (isInitialized && !user && currentView !== 'home') {
      console.log('App: User logged out, redirecting to home from:', currentView);
      setCurrentView('home');
      window.history.pushState({}, '', '/');
    }
  }, [user, isInitialized]);

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        console.log('Fetching auctions...');
        // Get both regular auctions and admin events
        const [regularAuctions, adminEvents] = await Promise.all([
          AuctionService.getAuctions(),
          AdminService.getAllAuctions()
        ]);
        
        console.log('Regular auctions:', regularAuctions.length);
        console.log('Admin events:', adminEvents.length);
        
        // Combine both types
        const auctionData = [...adminEvents, ...regularAuctions];
        console.log('Total combined auctions:', auctionData.length);
        setAuctions(auctionData);
        setFilteredAuctions(auctionData);
      } catch (error) {
        console.error('Error fetching auctions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isInitialized) {
      fetchAuctions();
      
      // Set up periodic refresh
      const interval = setInterval(() => {
        console.log('Periodic refresh...');
        fetchAuctions();
      }, 30000); // Refresh every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [isInitialized]);

  useEffect(() => {
    let filtered = auctions.filter(auction => {
      const matchesSearch = auction.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           auction.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === '' || auction.category === selectedCategory;
      const currentBid = auction.current_bid || auction.starting_price;
      const matchesPrice = currentBid >= priceRange[0] && (priceRange[1] >= 10000 ? true : currentBid <= priceRange[1]);
      
      return matchesSearch && matchesCategory && matchesPrice;
    });

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'ending_soon':
        filtered.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
        break;
      case 'price_low':
        filtered.sort((a, b) => (a.current_bid || a.starting_price) - (b.current_bid || b.starting_price));
        break;
      case 'price_high':
        filtered.sort((a, b) => (b.current_bid || b.starting_price) - (a.current_bid || a.starting_price));
        break;
      case 'most_bids':
        filtered.sort((a, b) => b.bid_count - a.bid_count);
        break;
    }

    setFilteredAuctions(filtered);
  }, [auctions, searchQuery, selectedCategory, sortBy, priceRange]);

  const handleViewChange = (view: View) => {
    // Restrict admin view to authorized users only
    if (view === 'admin' && !isAdminUser(user)) {
      console.warn('Unauthorized access attempt to admin console');
      return;
    }
    
    console.log('View change requested:', view, 'Current user:', user ? user.email : 'no user');
    setCurrentView(view);
    
    // Update URL without page refresh
    let path = '/';
    if (view === 'admin') {
      path = `/admin/${adminView}`;
    } else if (view !== 'home') {
      path = `/${view}`;
    }
    window.history.pushState({}, '', path);
  };

  const handleAdminViewChange = (view: AdminView) => {
    setAdminView(view);
    window.history.pushState({}, '', `/admin/${view}`);
  };

  const handleAuctionClick = (auction: Auction) => {
    setSelectedAuction(auction);
    setCurrentView('auction-detail');
    window.history.pushState({}, '', `/auction/${auction.id}`);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setCurrentView('auctions');
    window.history.pushState({}, '', '/auctions');
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-ironbound-grey-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ironbound-orange-500 mx-auto mb-4"></div>
          <p className="text-ironbound-grey-600">Loading IronBound Auctions...</p>
        </div>
      </div>
    );
  }

  // Debug logging
  console.log('App render state:', {
    isInitialized,
    user: user ? 'logged in' : 'not logged in'
  });

  const showHero = currentView === 'home';

  return (
    <div className="min-h-screen bg-ironbound-grey-500">
      <Header
        onViewChange={handleViewChange}
        onAuthClick={() => setShowAuthModal(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {raidBannerVisible && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap">
              <div className="flex items-center flex-1">
                <span className="flex p-2 rounded-lg bg-yellow-100">
                  <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </span>
                <p className="ml-3 text-sm font-medium text-yellow-800">
                  <span className="inline">RAID Storage: {raidBannerMessage}</span>
                </p>
              </div>
              <div className="mt-2 flex-shrink-0 w-full sm:mt-0 sm:w-auto">
                <button
                  onClick={() => setRaidBannerVisible(false)}
                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHero && (
        <>
          <Hero onGetStarted={() => setCurrentView('auctions')} />
          <FeaturedCategories onCategorySelect={handleCategorySelect} />
          <TrustIndicators />
        </>
      )}

      {(currentView === 'auctions' || currentView === 'home') && (
        <>
          <AuctionFilters
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sortBy={sortBy}
            onSortChange={setSortBy}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
          />
          <AuctionGrid
            auctions={filteredAuctions}
            onAuctionClick={handleAuctionClick}
            isLoading={isLoading}
          />
        </>
      )}

      {currentView === 'auction-detail' && selectedAuction && (
        <AuctionDetail
          auction={selectedAuction}
          onBack={() => setCurrentView('auctions')}
        />
      )}

      {currentView === 'profile' && (
        <UserProfile />
      )}

      {currentView === 'admin' && (
        <AdminPanel
          onBack={() => setCurrentView('home')}
          auctions={auctions}
          onAuctionsUpdate={setAuctions}
          adminView={adminView}
          onAdminViewChange={handleAdminViewChange}
        />
      )}

      {currentView === 'password-reset' && (
        <PasswordReset onComplete={() => {
          setCurrentView('home');
          window.history.pushState({}, '', '/');
          setShowAuthModal(true);
        }} />
      )}

      <Footer />

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}