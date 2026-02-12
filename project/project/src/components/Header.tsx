import React, { useState } from 'react';
import { Search, Menu, X, User, Plus, LogOut, Gavel, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { isAdminUser } from '../services/authService';

type View = 'home' | 'auctions' | 'auction-detail' | 'profile' | 'create-auction' | 'admin';

interface HeaderProps {
  onViewChange: (view: View) => void;
  onAuthClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Header({
  onViewChange,
  onAuthClick,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Check if current user is admin
  const isAdmin = isAdminUser(user);

  const handleLogout = () => {
    setShowUserMenu(false);
    setIsMobileMenuOpen(false);
    logout();
  };

  return (
    <header className="bg-ironbound-grey-500 shadow-lg border-b border-ironbound-grey-600 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => onViewChange('home')}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <img 
                src="/ironbound_primarylogog.png" 
                alt="IronBound Auctions" 
                className="h-12 w-auto"
              />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-white">IronBound Auctions</h1>
                <p className="text-xs text-ironbound-grey-200">Premium Online Auctions</p>
              </div>
            </button>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search auctions..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-ironbound-grey-300 rounded-lg text-ironbound-grey-900 placeholder-ironbound-grey-500 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
              />
            </div>
          </div>

          {/* Navigation - Desktop */}
          <div className="hidden md:flex items-center space-x-6">
            <button
              onClick={() => onViewChange('auctions')}
              className="flex items-center space-x-1 text-white hover:text-ironbound-orange-300 transition-colors font-medium"
            >
              <Gavel className="h-4 w-4" />
              <span>Browse Auctions</span>
            </button>

            {user ? (
              <div className="flex items-center space-x-4">
                {/* Admin Console Button - Prominent */}
                {isAdmin && (
                  <button
                    onClick={() => onViewChange('admin')}
                    className="flex items-center space-x-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Admin Console</span>
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 text-white hover:text-ironbound-orange-300 transition-colors"
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-8 w-8 rounded-full border-2 border-ironbound-grey-300"
                    />
                    <span className="font-medium">{user.name}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-ironbound-grey-200 py-1 z-50">
                      <button
                        onClick={() => {
                          onViewChange('profile');
                          setShowUserMenu(false);
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-left text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors"
                      >
                        <User className="h-4 w-4" />
                        <span>Profile</span>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            onViewChange('admin');
                            setShowUserMenu(false);
                          }}
                          className="flex items-center space-x-2 w-full px-4 py-2 text-left text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors"
                        >
                          <Settings className="h-4 w-4" />
                          <span>Admin Console</span>
                        </button>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-left text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={onAuthClick}
                className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-2 rounded-lg transition-colors font-medium"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white hover:text-ironbound-orange-300 transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-ironbound-grey-600">
            {user && (
              <div className="mb-4">
                <div className="flex items-center space-x-3 mb-4">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-8 w-8 rounded-full border-2 border-ironbound-grey-300"
                  />
                  <span className="text-white font-medium">{user.name}</span>
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search auctions..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-ironbound-grey-300 rounded-lg text-ironbound-grey-900 placeholder-ironbound-grey-500 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Mobile Navigation */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  onViewChange('auctions');
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left text-white hover:text-ironbound-orange-300 transition-colors py-2"
              >
                <Gavel className="h-4 w-4" />
                <span>Browse Events</span>
              </button>

              {user ? (
                <>
                  {/* Admin Console Button - Mobile */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        onViewChange('admin');
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center space-x-2 w-full text-left bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium mb-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Admin Console</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onViewChange('profile');
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 w-full text-left text-white hover:text-ironbound-orange-300 transition-colors py-2"
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 w-full text-left text-white hover:text-ironbound-orange-300 transition-colors py-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onAuthClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium text-left"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}