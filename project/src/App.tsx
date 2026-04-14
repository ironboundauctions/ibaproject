import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import FeaturedCategories from './components/FeaturedCategories';
import TrustIndicators from './components/TrustIndicators';
import AuctionFilters from './components/AuctionFilters';
import AuctionGrid from './components/AuctionGrid';
import AuctionDetail from './components/AuctionDetail';
import EventCatalogPage from './components/EventCatalogPage';
import AuthModal from './components/AuthModal';
import UserProfile from './components/UserProfile';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import AuthProvider from './components/AuthProvider';
import PasswordReset from './components/PasswordReset';
import { useAuth } from './hooks/useAuth';
import { Auction } from './types/auction';
import { AdminService } from './services/adminService';
import { isAdminUser, AuthService } from './services/authService';

type View = 'home' | 'auctions' | 'auction-detail' | 'event-catalog' | 'profile' | 'admin' | 'password-reset';

type AdminView = 'dashboard' | 'auctions' | 'create-event' | 'edit-event' | 'manage-lots' | 'create-lot' | 'edit-lot' | 'user-management' | 'admin-management' | 'create-admin' | 'create-auction' | 'consigners' | 'inventory' | 'admin-recovery' | 'recently-removed';

function AppContent() {
  const { user, isInitialized } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [filteredAuctions, setFilteredAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('ending_soon');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = isAdminUser(user);

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
            'create-admin', 'create-auction', 'consigners', 'inventory', 'admin-recovery',
            'recently-removed'
          ];

          if (validAdminViews.includes(adminRoute as AdminView)) {
            setAdminView(adminRoute as AdminView);
          } else {
            setAdminView('dashboard');
          }
        } else {
          // User not authorized for admin - redirect to home
          setCurrentView('home');
          window.history.replaceState({}, '', '/');
        }
      } else if (hash === '#admin') {
        if (isAdminUser(user)) {
          setCurrentView('admin');
          setAdminView('dashboard');
        } else {
          // User not authorized for admin - redirect to home
          setCurrentView('home');
          window.history.replaceState({}, '', '/');
        }
      } else if (path === '/profile' || hash === '#profile') {
        if (user) {
          setCurrentView('profile');
        } else {
          // User not logged in - redirect to home
          setCurrentView('home');
          window.history.replaceState({}, '', '/');
        }
      } else if (path === '/auctions' || hash === '#auctions') {
        setCurrentView('auctions');
      } else if (path.startsWith('/event/')) {
        const id = path.replace('/event/', '').split('/')[0];
        if (id) { setSelectedEventId(id); setCurrentView('event-catalog'); }
        else setCurrentView('auctions');
      } else if (path === '/' || path === '') {
        setCurrentView('home');
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
  }, [isInitialized, isAdmin]);


  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const publishedEvents = await AdminService.getPublishedAuctions();
        setAuctions(publishedEvents);
        setFilteredAuctions(publishedEvents);
      } catch (error) {
        console.error('Error fetching auctions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isInitialized) {
      fetchAuctions();

      const interval = setInterval(fetchAuctions, 30000);
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
      return;
    }

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
    if ((auction as any).is_event) {
      setSelectedEventId(auction.id);
      setCurrentView('event-catalog');
      window.history.pushState({}, '', `/event/${auction.id}`);
    } else {
      setSelectedAuction(auction);
      setCurrentView('auction-detail');
      window.history.pushState({}, '', `/auction/${auction.id}`);
    }
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

  const showHero = currentView === 'home';

  return (
    <div className="min-h-screen bg-ironbound-grey-500">
      <Header
        onViewChange={handleViewChange}
        onAuthClick={() => setShowAuthModal(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

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
          onBack={() => { setCurrentView('auctions'); window.history.pushState({}, '', '/auctions'); }}
        />
      )}

      {currentView === 'event-catalog' && selectedEventId && (
        <EventCatalogPage
          eventId={selectedEventId}
          onBack={() => { setCurrentView('auctions'); window.history.pushState({}, '', '/auctions'); }}
          onAuthRequired={() => setShowAuthModal(true)}
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