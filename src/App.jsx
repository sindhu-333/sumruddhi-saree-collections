import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  HashRouter as Router,
  Link,
  Redirect,
  Route,
  Switch,
  useLocation,
  useHistory,
  useParams
} from 'react-router-dom';
import BackgroundHero from './components/BackgroundHero';
import SareeGrid from './components/SareeGrid';
import CollectionScroller from './components/CollectionScroller';
import CartPanel from './components/CartPanel';
import PaymentModal from './components/PaymentModal';
import Footer from './components/Footer';
import PolicyModal from './components/PolicyModal';
import ReturnExchangeRequestPage from './components/ReturnExchangeRequestPage';
import AdminReturnsPage from './components/AdminReturnsPage';
import sareeSeed, { categories as seedCategories } from './data/sarees';
import logo from './logo.jpeg';
import './App.css';
import './styles/app.css';
import useScrollReveal from './animations/scroll/useScrollReveal';

const STORAGE_KEYS = {
  products: 'saree-products',
  users: 'saree-users',
  currentUser: 'saree-current-user',
  authToken: 'saree-auth-token',
  carts: 'saree-carts',
  bookings: 'saree-bookings',
  allBookings: 'saree-all-bookings',
  ratings: 'saree-customer-ratings',
  authFlash: 'saree-auth-flash',
  authFlashMode: 'saree-auth-flash-mode',
  themeMode: 'saree-theme-mode'
};

const DEFAULT_NEW_PRODUCT = {
  name: '',
  price: '',
  images: [],
  description: '',
  category: 'Silk',
  fabric: '',
  stock: '10',
  isNew: true
};

const ADMIN_SECTION_META = {
  profile: { eyebrow: 'Profile', title: 'Account summary', description: 'Review the admin account details and access level.' },
  orders: { eyebrow: 'Orders', title: 'Payment verification', description: 'Review bookings, screenshots, and confirmations.' },
  collection: { eyebrow: 'Collection', title: 'Collection management', description: 'Add, edit, and remove sarees by category in one place.' }
};

const BACK_OFFICE_ROLES = new Set(['admin', 'staff']);

function hasBackOfficeAccess(role) {
  return BACK_OFFICE_ROLES.has(role);
}

const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1610684537529-15f1e50c8767?w=600&h=700&fit=crop';

function isSafeImageSource(value) {
  if (typeof value !== 'string') return false;

  const normalized = value.trim();
  if (!normalized) return false;

  if (normalized.startsWith('data:image/')) {
    return normalized.includes(',');
  }

  return normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('blob:');
}

function isValidDataUri(value) {
  if (typeof value !== 'string') return false;

  const normalized = value.trim().replace(/\s+/g, '');
  const match = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return false;

  try {
    const payload = match[2];
    if (!payload || payload.length % 4 !== 0) return false;
    const decoded = atob(payload);
    return decoded.length > 0 && btoa(decoded) === payload;
  } catch (error) {
    return false;
  }
}

function resolveImageSource(value, fallback = FALLBACK_PRODUCT_IMAGE) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().replace(/\s+/g, '');
  if (!normalized) {
    return fallback;
  }

  if (/^data:image\//i.test(normalized)) {
    return isValidDataUri(normalized) ? normalized : fallback;
  }

  if (/^(https?:\/\/|blob:)/i.test(normalized)) {
    return normalized;
  }

  return fallback;
}
// Filenames allowed for homepage hero images (served from the public root as /b1.jpg, /b2.jpg, /b3.jpg, /s1.jpg)
const ALLOWED_HERO_FILENAMES = ['b1.jpg', 'b2.jpg', 'b3.jpg', 's1.jpg'];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : '/api';

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (err) {
    // Network-level failures (server down, CORS preflight blocked, mixed content, DNS, etc.)
    const message = `Network error: Failed to reach API (${API_BASE_URL}${path}). ${err && err.message ? err.message : ''}`;
    console.error(message, err);
    throw new Error(message);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || data?.message || 'Request failed';
    throw new Error(message);
  }

  return data;
}

function mapApiUserToProfile(user = {}) {
  return normalizeUserProfile({
    id: user.id,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    email: user.email || '',
    countryRegion: user.country_region || '',
    address: user.address || '',
    apartment: user.apartment || '',
    city: user.city || '',
    state: user.state || '',
    pincode: user.pincode || '',
    phone: user.phone || '',
    role: user.role || 'user'
  });
}

function createBookingRecord(item, paymentData) {
  const resolvedProductId = item.productId || item.id;

  return {
    id: `${Date.now()}-${item.id}-${Math.random().toString(16).slice(2)}`,
    productId: resolvedProductId,
    name: item.name,
    price: item.price,
    qty: item.qty,
    bookedAt: paymentData.submittedAt,
    status: paymentData.status,
    userId: paymentData.userId,
    userEmail: paymentData.userEmail,
    userName: paymentData.userName,
    screenshot: paymentData.screenshot,
    upiId: paymentData.upiId,
    paymentId: paymentData.paymentId,
    paymentTime: paymentData.paymentTime,
    totalAmount: paymentData.totalAmount
  };
}

function compactBookingForStorage(booking = {}) {
  return {
    id: booking.id,
    productId: booking.productId,
    name: booking.name,
    price: Number(booking.price || booking.unit_price || 0),
    qty: Number(booking.qty || booking.quantity || 1),
    bookedAt: booking.bookedAt || booking.submittedAt || booking.createdAt || booking.created_at || null,
    status: booking.status || 'verification_in_process',
    shipmentStatus: booking.shipmentStatus || booking.shipment_status || 'pending'
  };
}

function compactBookingListForStorage(bookings = [], maxItems = 25) {
  return Array.isArray(bookings)
    ? bookings.slice(0, maxItems).map(compactBookingForStorage)
    : [];
}

function normalizeBookingRecord(booking = {}) {
  const bookedAt = booking.submittedAt || booking.bookedAt || booking.created_at || booking.createdAt || null;

  return {
    ...booking,
    bookedAt,
    submittedAt: booking.submittedAt || bookedAt,
    paymentScreenshot: booking.paymentScreenshot || booking.screenshot || booking.payment_screenshot || null,
    screenshot: booking.screenshot || booking.paymentScreenshot || booking.payment_screenshot || null,
    userEmail: booking.userEmail || booking.customer_email || '',
    userName: booking.userName || booking.customer_name || '',
    userPhone: booking.userPhone || booking.customer_phone || '',
    customerAddress: booking.customerAddress || booking.customer_address || '',
    totalAmount: Number(booking.totalAmount || booking.total_amount || 0),
    price: Number(booking.price || booking.unit_price || 0),
    qty: Number(booking.qty || booking.quantity || 1),
    status: booking.status || 'verification_in_process',
    shipmentStatus: booking.shipmentStatus || booking.shipment_status || 'pending'
  };
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-IN') : 'N/A';
}

function buildOrderTrackingInfo(booking) {
  const bookedAt = new Date(booking.submittedAt || booking.bookedAt);
  const safeBookedAt = Number.isNaN(bookedAt.getTime()) ? new Date() : bookedAt;
  const daysToReach = booking.deliveryDays || Math.max(4, 4 + Math.max(0, Number(booking.qty || 1) - 1));
  const estimatedDeliveryAt = new Date(safeBookedAt.getTime() + (daysToReach * 24 * 60 * 60 * 1000));
  const elapsedHours = Math.max(0, Math.round((Date.now() - safeBookedAt.getTime()) / (1000 * 60 * 60)));

  return {
    bookedAt: safeBookedAt,
    daysToReach,
    estimatedDeliveryAt,
    estimatedDeliveryHours: daysToReach * 24,
    elapsedHours
  };
}

function updateUserInList(users, updatedUser) {
  return users.map((user) => (user.id === updatedUser.id ? updatedUser : user));
}

function buildDisplayName(profile = {}) {
  const firstName = String(profile.firstName || '').trim();
  const lastName = String(profile.lastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || String(profile.name || '').trim() || 'User';
}

function normalizeUserProfile(profile = {}) {
  return {
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    countryRegion: profile.countryRegion || '',
    address: profile.address || '',
    apartment: profile.apartment || '',
    city: profile.city || '',
    state: profile.state || '',
    pincode: profile.pincode || '',
    phone: profile.phone || '',
    name: buildDisplayName(profile),
    role: profile.role || 'user',
    password: profile.password || '',
    id: profile.id
  };
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  return safeParse(window.localStorage.getItem(key), fallback);
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn(`localStorage quota exceeded for key: ${key}. Clearing old data...`);
      // Clear older non-essential data to make room
      const keysToTry = [
        STORAGE_KEYS.ratings,
        STORAGE_KEYS.bookings,
        STORAGE_KEYS.allBookings
      ];
      for (const clearKey of keysToTry) {
        if (clearKey !== key) {
          try {
            window.localStorage.removeItem(clearKey);
          } catch (e) {
            // ignore
          }
        }
      }
      // Try again
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e2) {
        console.error(`Failed to write to localStorage after cleanup: ${key}`, e2);
      }
    } else {
      console.error('localStorage write error:', err);
    }
  }
}

function cartKeyFor(email) {
  return `${STORAGE_KEYS.carts}:${email}`;
}

function bookingsKeyFor(email) {
  return `${STORAGE_KEYS.bookings}:${email}`;
}

function allBookingsKey() {
  return STORAGE_KEYS.allBookings;
}

function initialAllBookings() {
  // allBookings is kept in memory only for the admin dashboard.
  // The authoritative booking list is loaded from the API after auth.
  return [];
}

function normalizeProduct(product, fallbackId) {
  const normalizedImages = Array.isArray(product.images)
    ? product.images
      .map((image) => resolveImageSource(image))
      .filter(Boolean)
    : [];
  const legacyImage = String(product.image || '').trim();
  const images = normalizedImages.length
    ? normalizedImages
    : legacyImage
      ? [resolveImageSource(legacyImage)]
      : [FALLBACK_PRODUCT_IMAGE];

  return {
    id: product.id ?? fallbackId,
    name: product.name || 'Untitled Saree',
    image: images[0],
    images,
    price: Number(product.price) || 0,
    description: product.description || 'Elegant saree collection piece.',
    category: product.category || 'Silk',
    fabric: product.fabric || product.category || 'Premium blend',
    rating: 0,
    ratingCount: 0,
    colors: product.colors || ['Ivory', 'Gold'],
    details: product.details || [
      'Soft drape and premium finish',
      'Comfortable for long wear',
      'Styling suitable for celebrations'
    ],
    isNew: Boolean(product.isNew)
  };
}

function normalizeCategoryName(category, products = []) {
  if (!category) return 'Misc';
  const trimmed = String(category).trim();
  const found = products.find((p) => String(p.category || '').trim().toLowerCase() === trimmed.toLowerCase());
  return found ? found.category : trimmed;
}

function initialProducts() {
  // Always use seed data on load - don't persist products to localStorage
  // Products should be fetched from the API instead
  return sareeSeed.map((product, index) => normalizeProduct(product, index + 1));
}

function initialUsers() {
  const storedUsers = readStorage(STORAGE_KEYS.users, []);
  return Array.isArray(storedUsers) ? storedUsers : [];
}

function initialCurrentUser() {
  const user = readStorage(STORAGE_KEYS.currentUser, null);
  return user && user.email ? normalizeUserProfile(user) : null;
}

function initialCart(email) {
  if (!email) {
    return {};
  }

  const stored = readStorage(cartKeyFor(email), {});
  return stored && typeof stored === 'object' ? stored : {};
}

function initialBookings(email) {
  if (!email) {
    return [];
  }

  const stored = readStorage(bookingsKeyFor(email), []);
  return Array.isArray(stored) ? stored.map(normalizeBookingRecord) : [];
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

function AppShell() {
  const history = useHistory();
  const location = useLocation();
  const [products, setProducts] = useState(initialProducts);
  const [users, setUsers] = useState(initialUsers);
  const [currentUser, setCurrentUser] = useState(initialCurrentUser);
  const [authToken, setAuthToken] = useState(() => readStorage(STORAGE_KEYS.authToken, null));
  const [cart, setCart] = useState(() => initialCart(initialCurrentUser()?.email));
  const [bookings, setBookings] = useState(() => initialBookings(initialCurrentUser()?.email));
  const [allBookings, setAllBookings] = useState(() => initialAllBookings());
  const [ratings, setRatings] = useState(() => readStorage(STORAGE_KEYS.ratings, []));
  const [heroImages, setHeroImages] = useState(() => readStorage('hero-images', [
    '/b3.jpeg',
    '/b1.jpeg',
    '/b2.jpeg'
  ]));

  
  const [authState, setAuthState] = useState({ open: false, mode: 'login' });
  const [pendingAction, setPendingAction] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingCartForPayment, setPendingCartForPayment] = useState([]);
  const [openPolicy, setOpenPolicy] = useState(null);
  const [themeMode, setThemeMode] = useState(() => readStorage(STORAGE_KEYS.themeMode, 'dark'));

  // Don't persist products to localStorage - fetch from API instead
  // useEffect(() => {
  //   writeStorage(STORAGE_KEYS.products, products);
  // }, [products]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.ratings, ratings);
  }, [ratings]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.users, users);
  }, [users]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.currentUser, currentUser);

    if (currentUser?.email) {
      setCart(initialCart(currentUser.email));
      setBookings(initialBookings(currentUser.email));
      return;
    }

    setCart({});
    setBookings([]);
  }, [currentUser]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.authToken, authToken || null);
  }, [authToken]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  useEffect(() => {
    try {
      document.body.classList.toggle('theme-dark', themeMode === 'dark');
      window.localStorage.setItem(STORAGE_KEYS.themeMode, themeMode);
    } catch (e) {
      // ignore
    }
  }, [themeMode]);

  // Global float-reveal for many page elements (adds .reveal and .in-view)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const selector = 'section, [id^="collections"], .grid-item, .collection-item, .collection-image-wrapper, .hero-content, .scroller-wrapper, .detail-gallery';
    const nodes = Array.from(document.querySelectorAll(selector));
    if (!nodes.length) return;


    nodes.forEach((el) => el.classList.add('reveal'));

    // Track scroll direction so entrance only triggers when entering while scrolling down
    const lastScroll = { y: typeof window !== 'undefined' ? window.scrollY : 0 };
    const lastDirection = { dir: 'down' };
    const onTrackScroll = () => {
      const y = window.scrollY || 0;
      lastDirection.dir = y >= (lastScroll.y || 0) ? 'down' : 'up';
      lastScroll.y = y;
    };
    window.addEventListener('scroll', onTrackScroll, { passive: true });

    // Stagger grid & collection items for a nicer entrance
    try {
      const staggerSelector = '.grid-item, .collection-item, .collection-image-wrapper';
      const staggerNodes = nodes.filter((n) => n.matches && n.matches(staggerSelector));
      if (staggerNodes.length) {
        // sort by vertical position then horizontal to approximate reading order
        staggerNodes.sort((a, b) => {
          const aa = a.getBoundingClientRect();
          const bb = b.getBoundingClientRect();
          if (aa.top === bb.top) return aa.left - bb.left;
          return aa.top - bb.top;
        });
        staggerNodes.forEach((el, i) => {
          const delay = Math.min(12, i) * 80; // small cap per visual group
          el.style.transitionDelay = `${delay}ms`;
          el.style.animationDelay = `${delay}ms`;
        });
      }
    } catch (e) {
      // safe fallback if layout info isn't available
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Trigger entrance depending on scroll direction so the motion
          // feels natural: elements entering while scrolling down animate
          // up from below; elements entering while scrolling up animate
          // down from above.
          if (lastDirection.dir === 'down') {
            entry.target.classList.remove('in-view-up');
            entry.target.classList.add('in-view');
          } else if (lastDirection.dir === 'up') {
            entry.target.classList.remove('in-view');
            entry.target.classList.add('in-view-up');
          }
        } else {
          // Only remove the visible classes when the user is scrolling down
          // past the element. Keep visible classes when scrolling up so the
          // page doesn't appear blank when navigating back.
          if (lastDirection.dir === 'down') {
            entry.target.classList.remove('in-view');
            entry.target.classList.remove('in-view-up');
          }
        }
      });
    }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    nodes.forEach((el) => obs.observe(el));

    return () => {
      obs.disconnect();
      window.removeEventListener('scroll', onTrackScroll);
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.email) {
      return;
    }

    writeStorage(cartKeyFor(currentUser.email), cart);
  }, [cart, currentUser]);

  useEffect(() => {
    if (!currentUser?.email) {
      return;
    }

    writeStorage(bookingsKeyFor(currentUser.email), compactBookingListForStorage(bookings));
  }, [bookings, currentUser]);

  // Persist hero images only; allBookings is loaded from API and not stored in localStorage.
  useEffect(() => {
    writeStorage('hero-images', heroImages || []);
  }, [heroImages]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/products')
      .then((items) => {
        if (!cancelled && Array.isArray(items) && items.length) {
          setProducts(items.map((product, index) => normalizeProduct({
            ...product,
            isNew: product.is_new
          }, index + 1)));
        }
      })
      .catch(() => {
        // Keep local fallback data when API is not available.
      });

    apiRequest('/ratings')
      .then((items) => {
        if (!cancelled && Array.isArray(items)) {
          setRatings(items.map((entry) => ({
            id: entry.id,
            bookingId: entry.booking_id,
            productId: entry.product_id,
            userId: entry.user_id,
            rating: Number(entry.rating),
            review: entry.review || '',
            createdAt: entry.created_at
          })));
        }
      })
      .catch(() => {
        // Ignore and keep current client state.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      return;
    }

    const flashMessage = readStorage(STORAGE_KEYS.authFlash, '');
    const flashMode = readStorage(STORAGE_KEYS.authFlashMode, '');

    if (!flashMessage) {
      return;
    }

    setNotice({ message: flashMessage, type: 'success' });

    if (flashMode === 'login') {
      openAuth('login');
    }

    window.localStorage.removeItem(STORAGE_KEYS.authFlash);
    window.localStorage.removeItem(STORAGE_KEYS.authFlashMode);
  }, [currentUser]);

  useEffect(() => {
    if (!authToken || !currentUser) {
      return;
    }

    apiRequest('/bookings', {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
      .then((items) => {
        if (!Array.isArray(items)) return;
        const normalizedItems = items.map(normalizeBookingRecord);
        if (currentUser.role === 'admin') {
          setAllBookings(normalizedItems);
        } else {
          setBookings(normalizedItems);
        }
      })
      .catch(() => {
        // Keep existing local data on transient API errors.
      });
  }, [authToken, currentUser]);

  const newArrivals = useMemo(() => products.filter((product) => product.isNew), [products]);
  const categories = useMemo(() => {
    const seen = new Set();

    return products.reduce((list, product) => {
      if (!product.category || seen.has(product.category)) {
        return list;
      }

      seen.add(product.category);
      list.push({
        id: product.category,
        name: product.category,
        image: product.image,
        description: `${product.category} sarees`
      });
      return list;
    }, []);
  }, [products]);

  const addToast = (message, type = 'success') => {
    setNotice({ message, type });
  };

  const closeAuth = () => {
    setAuthState({ open: false, mode: 'login' });
    setPendingAction(null);
  };

  const openAuth = (mode = 'login', action = null) => {
    setAuthState({ open: true, mode });
    setPendingAction(() => action);
  };

  const handleAddToCart = (product) => {
    if (currentUser?.role !== 'user') {
      openAuth('login', () => handleAddToCart(product));
      return;
    }

    setCart((prev) => {
      const existing = prev[product.id];
      const nextQty = existing ? existing.qty + 1 : 1;

      return {
        ...prev,
        [product.id]: { ...product, qty: nextQty }
      };
    });

    addToast(`${product.name} added to cart`, 'success');
  };

  const handleRemoveFromCart = (item) => {
    setCart((prev) => {
      if (!prev[item.id]) {
        return prev;
      }

      const nextQty = (prev[item.id].qty || 0) - 1;

      if (nextQty <= 0) {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      }

      return {
        ...prev,
        [item.id]: { ...prev[item.id], qty: nextQty }
      };
    });
  };

  const handleOpenDetails = (product) => {
    history.push(`/saree/${product.id}`);
  };

  const handlePaymentComplete = async (paymentData) => {
    if (!authToken) {
      addToast('Please login again before placing order', 'error');
      return;
    }

    try {
      const cartItems = (paymentData.cartItems || []).map((item) => {
        const matchedProduct = products.find((product) => {
          const itemId = item.productId || item.id;
          const itemName = String(item.name || '').trim().toLowerCase();
          const productName = String(product.name || '').trim().toLowerCase();
          return String(product.id) === String(itemId) || (itemName && itemName === productName);
        });

        return {
          ...matchedProduct,
          ...item,
          id: matchedProduct?.id ?? item.id,
          productId: item.productId || item.id || matchedProduct?.id,
          name: item.name || matchedProduct?.name,
          price: Number(item.price || matchedProduct?.price || 0),
          qty: Number(item.qty || 1)
        };
      });

      const missingProduct = cartItems.find((item) => !item.productId);
      if (missingProduct) {
        throw new Error('Booking item is missing a product id. Please reopen the product and try booking again.');
      }

      const createdBookings = await Promise.all(
        cartItems.map((item) => apiRequest('/bookings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            product_id: item.productId,
            productId: item.productId,
            quantity: item.qty,
            unit_price: item.price,
            unitPrice: item.price,
            total_amount: Number(item.price || 0) * Number(item.qty || 1),
            totalAmount: Number(item.price || 0) * Number(item.qty || 1),
            customer_name: currentUser?.name,
            customerName: currentUser?.name,
            customer_email: currentUser?.email,
            customerEmail: currentUser?.email,
            customer_phone: currentUser?.phone,
            customerPhone: currentUser?.phone,
            customer_address: [currentUser?.address, currentUser?.apartment, currentUser?.city, currentUser?.state, currentUser?.pincode]
              .filter(Boolean)
              .join(', '),
            customerAddress: [currentUser?.address, currentUser?.apartment, currentUser?.city, currentUser?.state, currentUser?.pincode]
              .filter(Boolean)
              .join(', '),
            upi_id: paymentData.upiId,
            upiId: paymentData.upiId,
            payment_id: paymentData.paymentId,
            paymentId: paymentData.paymentId,
            payment_time: paymentData.paymentTime,
            paymentTime: paymentData.paymentTime,
            payment_screenshot: paymentData.screenshot,
            paymentScreenshot: paymentData.screenshot,
            status: paymentData.status || 'verification_in_process'
          })
        }))
      );
      const normalizedBookings = createdBookings.map(normalizeBookingRecord);
      console.debug('[BOOKING_CREATED_CLIENT]', { paymentData, createdBookings });

      // Merge optimistic creations, then refresh from server to ensure DB-authoritative state
      setBookings((prev) => [...normalizedBookings, ...prev]);
      setAllBookings((prev) => [...normalizedBookings, ...prev]);

      try {
        const refreshed = await apiRequest('/bookings', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (Array.isArray(refreshed)) {
          const normalized = refreshed.map(normalizeBookingRecord);
          if (currentUser.role === 'admin') {
            setAllBookings(normalized);
          } else {
            setBookings(normalized);
          }
        }
      } catch (err) {
        console.warn('[BOOKING_REFRESH_FAIL]', err?.message || err);
      }
      setCart({});
      setPendingCartForPayment([]);
      setIsPaymentModalOpen(false);
      addToast('Payment proof submitted for verification', 'success');
    } catch (error) {
      addToast(error.message || 'Could not submit order', 'error');
    }
  };

  const handlePaymentCancel = () => {
    setIsPaymentModalOpen(false);
    setPendingCartForPayment([]);
  };

  const getAverageRating = (productId) => {
    const productRatings = ratings.filter(r => String(r.productId) === String(productId));
    if (productRatings.length === 0) return 0;
    const average = productRatings.reduce((sum, r) => sum + r.rating, 0) / productRatings.length;
    return average;
  };

  const getRatingCount = (productId) => {
    return ratings.filter(r => String(r.productId) === String(productId)).length;
  };

  const hasUserRatedBooking = (bookingId) => {
    return ratings.some(r => String(r.bookingId) === String(bookingId));
  };

  const approveBooking = async (bookingId) => {
    if (!authToken) {
      addToast('Admin session expired. Login again.', 'error');
      return;
    }

    try {
      const updated = await apiRequest(`/bookings/${bookingId}/approve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          delivery_eta: '4-7 business days'
        })
      });

      const normalized = normalizeBookingRecord(updated);
      setAllBookings((prev) => prev.map((b) => (String(b.id) === String(bookingId) ? normalized : b)));
      addToast('Booking approved and customer notified', 'success');
    } catch (error) {
      addToast(error.message || 'Could not approve booking', 'error');
    }
  };

  const rejectBooking = async (bookingId) => {
    if (!authToken) {
      addToast('Admin session expired. Login again.', 'error');
      return;
    }

    try {
      const updated = await apiRequest(`/bookings/${bookingId}/reject`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          admin_note: 'Please re-submit payment details or contact support.'
        })
      });

      const normalized = normalizeBookingRecord(updated);
      setAllBookings((prev) => prev.map((b) => (String(b.id) === String(bookingId) ? normalized : b)));
      addToast('Booking rejected and customer notified', 'success');
    } catch (error) {
      addToast(error.message || 'Could not reject booking', 'error');
    }
  };

  const updateShipmentStatus = async (bookingId, shipmentStatus) => {
    if (!authToken) {
      addToast('Admin session expired. Login again.', 'error');
      return;
    }

    try {
      const updated = await apiRequest(`/bookings/${bookingId}/shipment`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          shipment_status: shipmentStatus
        })
      });

      const normalized = normalizeBookingRecord(updated);
      setAllBookings((prev) => prev.map((b) => (String(b.id) === String(bookingId) ? normalized : b)));
      const statusLabel = shipmentStatus === 'shipped' ? 'marked as shipped' : 'marked as delivered';
      addToast(`Booking ${statusLabel} and customer notified`, 'success');
    } catch (error) {
      addToast(error.message || 'Could not update shipment status', 'error');
    }
  };

  const handleSubmitRating = async (bookingId, productId, ratingValue, reviewText) => {
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      addToast('Please select a rating between 1 and 5', 'error');
      return;
    }

    if (!authToken) {
      addToast('Please login to submit a rating', 'error');
      return;
    }

    try {
      const ratingData = await apiRequest('/ratings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          booking_id: bookingId,
          product_id: productId,
          rating: Number(ratingValue),
          review: reviewText?.trim() || null
        })
      });

      // Normalize and add to local state
      const normalizedRating = {
        id: ratingData.id,
        bookingId: ratingData.booking_id,
        productId: ratingData.product_id,
        userId: ratingData.user_id,
        rating: Number(ratingData.rating),
        review: ratingData.review || '',
        createdAt: ratingData.created_at
      };

      setRatings((prev) => [...prev, normalizedRating]);
      addToast('Thank you for your rating! It will help other customers.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not submit rating', 'error');
    }
  };

  const handleAuthSubmit = async ({ mode, email, password, firstName, lastName, ...formData }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    try {
      if (mode === 'signup') {
        await apiRequest('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            first_name: firstName,
            last_name: lastName,
            country_region: formData.countryRegion,
            address: formData.address,
            apartment: formData.apartment,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            phone: formData.phone
          })
        });

        closeAuth();
        addToast('Account created. Verify your email before login.', 'success');
        return;
      }

      const loginBody = {
        email: normalizedEmail,
        password
      };

      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginBody)
      });

      const loggedInUser = mapApiUserToProfile(data.user);
      setCurrentUser(loggedInUser);
      setAuthToken(data.token);
      closeAuth();
      addToast(`Welcome back, ${loggedInUser.name}`, 'success');

      if (loggedInUser.role === 'admin' || loggedInUser.role === 'staff') {
        history.push('/admin');
        return;
      }

      if (pendingAction) {
        const action = pendingAction;
        setPendingAction(null);
        window.setTimeout(() => action(), 0);
        return;
      }

      history.push('/account');
    } catch (error) {
      const message = error?.message || 'Authentication failed';
      if (message.toLowerCase().includes('email not verified')) {
        throw error;
      }
      addToast(message, 'error');
      throw error;
    }
  };

  const handleVerifyEmailToken = async (token) => {
    try {
      await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      addToast('Email verified. You can now login.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not verify email', 'error');
      throw error;
    }
  };

  const handleRequestPasswordReset = async (email) => {
    try {
      await apiRequest('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      addToast('Password reset instructions sent to email', 'success');
    } catch (error) {
      addToast(error.message || 'Could not request password reset', 'error');
      throw error;
    }
  };

  const handleResetPassword = async (token, newPassword) => {
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword })
      });
      addToast('Password reset successful. Please login.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not reset password', 'error');
      throw error;
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken(null);
    setIsCartOpen(false);
    setIsUserMenuOpen(false);
    setIsSearchOpen(false);
    setIsAdminMenuOpen(false);
    addToast('Logged out successfully', 'success');
  };

  const handleUpdateProfile = (updates) => {
    if (!currentUser) {
      return;
    }

    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);
    setUsers((prev) => updateUserInList(prev, updatedUser));
    addToast('Profile updated', 'success');
  };

  const handleCreateStaff = async ({ firstName, lastName, email, password, phone }) => {
    try {
      await apiRequest('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          phone
        })
      });

      addToast('Staff account created successfully', 'success');
    } catch (error) {
      addToast(error.message || 'Could not create staff account', 'error');
      throw error;
    }
  };

  const handleChangePassword = () => {
    addToast('Use "Forgot password" in login to reset securely via email.', 'error');
    return false;
  };

  const handleAddProduct = async (productData) => {
    try {
      const payload = {
        name: productData.name,
        description: productData.description,
        price: Number(productData.price || 0),
        stock: Number(productData.stock || 0),
        category: productData.category,
        fabric: productData.fabric,
        images: Array.isArray(productData.images) ? productData.images : [],
        details: Array.isArray(productData.details) ? productData.details : [],
        isNew: Boolean(productData.isNew)
      };

      const newProduct = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      setProducts((prev) => [normalizeProduct(newProduct, newProduct.id), ...prev]);
      addToast('Product added successfully', 'success');
    } catch (err) {
      console.error('Error adding product:', err);
      addToast(err.message || 'Failed to add product', 'error');
    }
  };

  const handleEditProduct = async (productData) => {
    try {
      const payload = {
        name: productData.name,
        description: productData.description,
        price: Number(productData.price || 0),
        stock: Number(productData.stock || 0),
        category: productData.category,
        fabric: productData.fabric,
        images: Array.isArray(productData.images) ? productData.images : [],
        details: Array.isArray(productData.details) ? productData.details : [],
        isNew: Boolean(productData.isNew)
      };

      const updatedProduct = await apiRequest(`/products/${productData.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      setProducts((prev) => prev.map((product) => {
        if (String(product.id) !== String(productData.id)) {
          return product;
        }
        return normalizeProduct(updatedProduct, product.id);
      }));
      addToast('Product updated successfully', 'success');
    } catch (err) {
      console.error('Error updating product:', err);
      addToast(err.message || 'Failed to update product', 'error');
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      await apiRequest(`/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      setProducts((prev) => prev.filter((product) => String(product.id) !== String(productId)));
      addToast('Product removed successfully', 'success');
    } catch (err) {
      console.error('Error removing product:', err);
      addToast(err.message || 'Failed to remove product', 'error');
    }
  };

  const bookProduct = (product) => {
    if (currentUser?.role !== 'user') {
      openAuth('login', () => bookProduct(product));
      return;
    }

    setPendingCartForPayment([{ ...product, productId: product.id, qty: 1 }]);
    setIsPaymentModalOpen(true);
  };

  const bookCart = () => {
    if (currentUser?.role !== 'user') {
      openAuth('login', bookCart);
      return;
    }

    const items = Object.values(cart).map((item) => ({
      ...item,
      productId: item.productId || item.id
    }));
    if (items.length === 0) {
      addToast('Add sarees to cart before booking', 'error');
      return;
    }

    setPendingCartForPayment(items);
    setIsPaymentModalOpen(true);
    setIsCartOpen(false);
  };

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, item) => sum + (item.qty || 0), 0);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    setSearchTerm(trimmed);
    if (trimmed) {
      setIsSearchOpen(false);
    }
  };

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return products;
    }

    return products.filter((product) => {
      const searchable = [product.name, product.description, product.category, product.fabric, ...(product.details || [])]
        .join(' ')
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [products, searchTerm]);

  const storefrontProducts = searchResults;

  return (
    <div className="app-shell">
      <AppHeader
        currentUser={currentUser}
        cartCount={cartCount}
        themeMode={themeMode}
        onThemeToggle={() => setThemeMode((mode) => (mode === 'dark' ? 'light' : 'dark'))}
        onCartToggle={() => setIsCartOpen((prev) => !prev)}
        onMenuToggle={() => setIsUserMenuOpen((prev) => !prev)}
        isMenuOpen={isUserMenuOpen}
        onCloseMenu={() => setIsUserMenuOpen(false)}
        onSearchToggle={() => setIsSearchOpen((prev) => !prev)}
        onLogin={() => openAuth('login')}
        onSignup={() => openAuth('signup')}
        onLogout={handleLogout}
        onAdminMenuToggle={() => setIsAdminMenuOpen((prev) => !prev)}
        isAdminMenuOpen={isAdminMenuOpen}
        onCloseAdminMenu={() => setIsAdminMenuOpen(false)}
        onOpenPolicy={setOpenPolicy}
      />

      {isSearchOpen ? (
        <div className="search-bar-wrapper">
          <form className="search-bar-form" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Search sarees by name, category, fabric..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search sarees"
              autoFocus
            />
            <button type="submit" className="primary-btn" disabled={!searchTerm.trim()}>
              Search
            </button>
            <button type="button" className="ghost-btn" onClick={() => setIsSearchOpen(false)}>
              Close
            </button>
          </form>
          {searchTerm.trim() ? (
            <div className="search-summary">
              {`${searchResults.length} result${searchResults.length === 1 ? '' : 's'} for "${searchTerm.trim()}"`}
            </div>
          ) : null}
        </div>
      ) : null}

      {notice ? <NoticeBanner notice={notice} /> : null}

      <Switch>
        <Route exact path="/">
          <HomePage
            products={storefrontProducts}
            categories={categories}
            newArrivals={newArrivals}
            currentUser={currentUser}
            onAddToCart={handleAddToCart}
            onOpenDetails={handleOpenDetails}
            onRequestLogin={() => openAuth('login')}
            onRequestSignup={() => openAuth('signup')}
            cart={cart}
            onCheckout={bookCart}
            onRemoveFromCart={handleRemoveFromCart}
            getAverageRating={getAverageRating}
            getRatingCount={getRatingCount}
            heroImages={heroImages}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
          />
        </Route>
        <Route path="/saree/:id">
          <SareeDetailPage
            products={products}
            currentUser={currentUser}
            onBack={() => history.push('/')}
            onAddToCart={handleAddToCart}
            onBookProduct={bookProduct}
            onRequestLogin={() => openAuth('login')}
            getAverageRating={getAverageRating}
            getRatingCount={getRatingCount}
          />
        </Route>
        <Route path="/verify-email">
          <VerifyEmailPage
            currentUser={currentUser}
            onVerifyEmailToken={handleVerifyEmailToken}
            onOpenLogin={() => openAuth('login')}
            onBack={() => history.push('/')}
          />
        </Route>
        <Route path="/reset-password">
          <ResetPasswordPage
            currentUser={currentUser}
            onResetPassword={handleResetPassword}
            onOpenLogin={() => openAuth('login')}
            onBack={() => history.push('/')}
          />
        </Route>
        <Route path="/return-exchange-request">
          <ReturnExchangeRequestPage />
        </Route>
        <Route exact path="/account">
          {currentUser?.role === 'user' ? (
            <UserAccountPage
              currentUser={currentUser}
              bookings={bookings}
              products={products}
              onUpdateProfile={handleUpdateProfile}
              onChangePassword={handleChangePassword}
              onSubmitRating={handleSubmitRating}
              hasUserRatedBooking={hasUserRatedBooking}
              onContactSupport={() => {
                document.getElementById('footer-contact-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onBack={() => history.push('/')}
            />
          ) : (
            <Redirect to="/" />
          )}
        </Route>
        <Route exact path="/admin">
          {currentUser?.role === 'admin' ? <Redirect to="/admin/profile" /> : currentUser?.role === 'staff' ? <Redirect to="/admin/orders" /> : <Redirect to="/" />}
        </Route>
        <Route path="/admin/profile">
          {hasBackOfficeAccess(currentUser?.role) ? (
            <AdminPanelPage
              section="profile"
              products={products}
              currentUser={currentUser}
              onUpdateProfile={handleUpdateProfile}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onRemoveProduct={handleRemoveProduct}
              allBookings={allBookings}
              onApproveBooking={approveBooking}
              onRejectBooking={rejectBooking}
              onUpdateShipment={updateShipmentStatus}
              onOpenDetails={handleOpenDetails}
              onNotify={addToast}
              heroImages={heroImages}
              onUpdateHeroImages={setHeroImages}
              onCreateStaff={handleCreateStaff}
            />
          ) : (
            <Redirect to="/" />
          )}
        </Route>
        <Route path="/admin/settings">
          {currentUser?.role === 'admin' ? <Redirect to="/admin/profile" /> : currentUser?.role === 'staff' ? <Redirect to="/admin/orders" /> : <Redirect to="/" />}
        </Route>
        <Route path="/admin/orders">
          {hasBackOfficeAccess(currentUser?.role) ? (
            <AdminPanelPage
              section="orders"
              products={products}
              currentUser={currentUser}
              onUpdateProfile={handleUpdateProfile}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onRemoveProduct={handleRemoveProduct}
              allBookings={allBookings}
              onApproveBooking={approveBooking}
              onRejectBooking={rejectBooking}
              onUpdateShipment={updateShipmentStatus}
              onOpenDetails={handleOpenDetails}
              onNotify={addToast}
              heroImages={heroImages}
              onUpdateHeroImages={setHeroImages}
              onCreateStaff={handleCreateStaff}
            />
          ) : (
            <Redirect to="/" />
          )}
        </Route>
        <Route path="/admin/collection">
          {currentUser?.role === 'admin' ? (
            <AdminPanelPage
              section="collection"
              products={products}
              currentUser={currentUser}
              onUpdateProfile={handleUpdateProfile}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onRemoveProduct={handleRemoveProduct}
              allBookings={allBookings}
              onApproveBooking={approveBooking}
              onRejectBooking={rejectBooking}
              onUpdateShipment={updateShipmentStatus}
              onOpenDetails={handleOpenDetails}
              onNotify={addToast}
              heroImages={heroImages}
              onUpdateHeroImages={setHeroImages}
              onCreateStaff={handleCreateStaff}
            />
          ) : (
            <Redirect to={currentUser?.role === 'staff' ? '/admin/orders' : '/'} />
          )}
        </Route>
        <Route path="/admin/returns">
          {currentUser?.role === 'admin' ? (
            <AdminReturnsPage />
          ) : (
            <Redirect to={currentUser?.role === 'staff' ? '/admin/orders' : '/'} />
          )}
        </Route>
        <Route path="/admin/uploads">
          {currentUser?.role === 'admin' ? (
            <AdminPanelPage
              section="uploads"
              products={products}
              currentUser={currentUser}
              onUpdateProfile={handleUpdateProfile}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onRemoveProduct={handleRemoveProduct}
              allBookings={allBookings}
              onApproveBooking={approveBooking}
              onRejectBooking={rejectBooking}
              onUpdateShipment={updateShipmentStatus}
              onOpenDetails={handleOpenDetails}
              onNotify={addToast}
              heroImages={heroImages}
              onUpdateHeroImages={setHeroImages}
              onCreateStaff={handleCreateStaff}
            />
          ) : (
            <Redirect to={currentUser?.role === 'staff' ? '/admin/orders' : '/'} />
          )}
        </Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>

      {isCartOpen ? <div className="cart-drawer-backdrop" onClick={() => setIsCartOpen(false)} /> : null}
      <CartPanel
        cart={cart}
        onCheckout={bookCart}
        onRemove={handleRemoveFromCart}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPendingCartForPayment([]);
        }}
        onCancel={handlePaymentCancel}
        totalAmount={pendingCartForPayment.reduce((sum, item) => sum + (item.price * item.qty), 0)}
        cartItems={pendingCartForPayment}
        onPaymentComplete={handlePaymentComplete}
        currentUser={currentUser}
      />

      <AuthModal
        open={authState.open}
        mode={authState.mode}
        onClose={closeAuth}
        onSubmit={handleAuthSubmit}
        onRequestPasswordReset={handleRequestPasswordReset}
        onResetPassword={handleResetPassword}
        onVerifyEmailToken={handleVerifyEmailToken}
      />

        <PolicyModal 
          isOpen={!!openPolicy}
          policyType={openPolicy}
          onClose={() => setOpenPolicy(null)}
        />

        <Footer onOpenPolicy={setOpenPolicy} />
    </div>
  );
}

function AppHeader({ currentUser, cartCount, themeMode, onThemeToggle, onCartToggle, onMenuToggle, isMenuOpen, onCloseMenu, onSearchToggle, onLogin, onSignup, onLogout, onAdminMenuToggle, isAdminMenuOpen, onCloseAdminMenu, onOpenPolicy }) {

  const history = useHistory();
  const location = useLocation();

  const goToHomeTop = () => {
    const currentPath = `${location.pathname}${location.search || ''}`;
    if (currentPath !== '/') {
      history.push('/');
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 0);
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (sectionId) => {
    const currentPath = `${location.pathname}${location.search || ''}`;
    if (currentPath !== '/') {
      history.push('/');
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAdminMenuClick = () => {
    onAdminMenuToggle();
  };

  const openAdminWindow = (path) => {
    const targetPath = path || '/';
    if (location.pathname === targetPath) {
      onCloseAdminMenu();
      return;
    }
    history.push(targetPath);
    onCloseAdminMenu();
  };

  if (currentUser?.role === 'user') {
    return (
      <>
        <header className="app-header app-header-compact">
          <button type="button" className="header-icon-button menu-button" aria-label="Open menu" aria-expanded={isMenuOpen} onClick={onMenuToggle}>
            <span className="icon-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <button type="button" className="brand-compact" onClick={() => history.push('/')} aria-label="Go to home">
            <img src={logo} alt="Samruddhi Saree Collections logo" className="brand-logo-image" />
            <span className="brand-compact-copy">
              <span className="brand-compact-name">SAMRUDDHI</span>
              <span className="brand-compact-tag">Saree Collections</span>
            </span>
          </button>

          <div className="header-compact-actions">
            <button type="button" className="theme-toggle-button" aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={onThemeToggle}>
              <i className={themeMode === 'dark' ? 'fas fa-sun' : 'fas fa-moon'} aria-hidden="true" />
            </button>
            <button type="button" className="header-icon-button" aria-label="Search collections" onClick={onSearchToggle}>
              <span className="icon-search" aria-hidden="true" />
            </button>

            <Link className="header-icon-link" to="/account" aria-label="My account">
              <span className="icon-user" aria-hidden="true" />
            </Link>

            <button type="button" className="header-cart-button" onClick={onCartToggle} aria-label={`Cart with ${cartCount} items`}>
              <span className="icon-cart" aria-hidden="true" />
              <span className="cart-count-badge">{cartCount}</span>
            </button>
          </div>
        </header>

        {isMenuOpen ? (
          <>
            <div className="user-menu-backdrop" onClick={onCloseMenu} />
            <div className="user-menu-panel">
              <button type="button" className="user-menu-item" onClick={() => { history.push('/'); onCloseMenu(); }}>
                Home
              </button>
              <button type="button" className="user-menu-item" onClick={() => { history.push('/account?tab=orders'); onCloseMenu(); }}>
                Track Order
              </button>
              <button type="button" className="user-menu-item" onClick={() => { onOpenPolicy('shipping'); onCloseMenu(); }}>
                Shipping Policy
              </button>
              <button type="button" className="user-menu-item" onClick={() => { onOpenPolicy('returns'); onCloseMenu(); }}>
                Returns & Exchange
              </button>
              <button type="button" className="user-menu-item" onClick={() => { onOpenPolicy('privacy'); onCloseMenu(); }}>
                Privacy Policy
              </button>
              <button type="button" className="user-menu-item user-menu-logout" onClick={() => { onLogout(); onCloseMenu(); }}>
                Logout
              </button>
            </div>
          </>
        ) : null}
        {/* Admin uploads manager removed from header scope; admin UI handled in admin routes/components */}
      </>
    );
  }

  if (hasBackOfficeAccess(currentUser?.role)) {
    return (
      <>
        <header className="app-header app-header-admin">
          <button type="button" className="header-icon-button admin-menu-button" aria-label="Open admin menu" aria-expanded={isAdminMenuOpen} onClick={handleAdminMenuClick}>
            <span className="icon-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <button type="button" className="brand-compact brand-admin-brand" onClick={() => history.push(currentUser?.role === 'staff' ? '/admin/orders' : '/admin')} aria-label="Go to admin dashboard">
            <img src={logo} alt="Samruddhi Saree Collections logo" className="brand-logo-image" />
            <span className="brand-compact-copy">
              <span className="brand-compact-name">SAMRUDDHI</span>
              <span className="brand-compact-tag">Saree Collections</span>
            </span>
          </button>

          <button type="button" className="theme-toggle-button" aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={onThemeToggle}>
            <i className={themeMode === 'dark' ? 'fas fa-sun' : 'fas fa-moon'} aria-hidden="true" />
          </button>
        </header>

        {isAdminMenuOpen ? (
          <>
            <div className="user-menu-backdrop" onClick={onCloseAdminMenu} />
            <div className="admin-menu-panel">
              <button type="button" className="user-menu-item" onClick={() => openAdminWindow('/')}>
                Home
              </button>
              <button type="button" className="user-menu-item" onClick={() => openAdminWindow('/admin/profile')}>
                Profile
              </button>
              <button type="button" className="user-menu-item" onClick={() => openAdminWindow('/admin/orders')}>
                Order Track
              </button>
              {currentUser?.role === 'admin' ? (
                <>
                  <button type="button" className="user-menu-item" onClick={() => openAdminWindow('/admin/returns')}>
                    Returns
                  </button>
                  <button type="button" className="user-menu-item" onClick={() => openAdminWindow('/admin/collection')}>
                    Manage Collection
                  </button>
                </>
              ) : null}
              <button type="button" className="user-menu-item user-menu-logout" onClick={() => { onLogout(); onCloseAdminMenu(); }}>
                Logout
              </button>
            </div>
          </>
        ) : null}
      </>
    );
  }

  return (
    <header className="app-header">
      <div className="brand-block">
        <img src={logo} alt="Samruddhi Saree Collections logo" className="brand-logo-image" />
        <div>
          <div className="brand-name">Samruddhi Saree Collections</div>
          <div className="brand-tag">Admin-managed saree storefront</div>
        </div>
      </div>

      <nav className="header-links">
        <button type="button" className="link-button" onClick={goToHomeTop}>
          Home
        </button>
        <button type="button" className="link-button" onClick={() => scrollToSection('category')}>
          Category
        </button>
        <button type="button" className="link-button" onClick={() => scrollToSection('collections')}>
          Collections
        </button>
      </nav>

      <div className="header-actions">
        <button type="button" className="header-icon-button" aria-label="Search collections" onClick={onSearchToggle}>
          <span className="icon-search" aria-hidden="true" />
        </button>
        <button type="button" className="theme-toggle-button" aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={onThemeToggle}>
          <i className={themeMode === 'dark' ? 'fas fa-sun' : 'fas fa-moon'} aria-hidden="true" />
        </button>
        {currentUser ? (
          <>
            <span className="user-chip">{currentUser.name}</span>
            <button className="ghost-btn" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <>
            <button className="ghost-btn" onClick={onLogin}>Login</button>
            <button className="ghost-btn" onClick={onSignup}>Sign Up</button>
          </>
        )}
      </div>
    </header>
  );
}

function NoticeBanner({ notice }) {
  return (
    <div className={`notice-banner ${notice.type || 'success'}`}>
      {notice.message}
    </div>
  );
}

function VerifyEmailPage({ currentUser, onVerifyEmailToken, onOpenLogin, onBack }) {
  const location = useLocation();
  const history = useHistory();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email...');
  const [manualToken, setManualToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token');

    if (!token) {
      setStatus('missing');
      setMessage('No verification code was found. Use the code from your email or request a new one.');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setMessage('Verifying your email...');

    onVerifyEmailToken(token)
      .then(() => {
        if (cancelled) return;
        setStatus('success');
        const successMessage = 'Email verified successfully. Please log in now.';
        setMessage(successMessage);
        window.localStorage.setItem(STORAGE_KEYS.authFlash, successMessage);
        window.localStorage.setItem(STORAGE_KEYS.authFlashMode, 'login');
        window.setTimeout(() => {
          history.replace('/');
          onOpenLogin?.();
        }, 700);
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(error.message || 'Could not verify email.');
      });

    return () => {
      cancelled = true;
    };
  }, [location.search, onVerifyEmailToken]);

  const handleManualVerify = async (event) => {
    event.preventDefault();
    if (!manualToken.trim()) return;

    try {
      setIsSubmitting(true);
      setStatus('loading');
      setMessage('Verifying your email...');
      await onVerifyEmailToken(manualToken.trim());
      setStatus('success');
      const successMessage = 'Email verified successfully. Please log in now.';
      setMessage(successMessage);
      window.localStorage.setItem(STORAGE_KEYS.authFlash, successMessage);
      window.localStorage.setItem(STORAGE_KEYS.authFlashMode, 'login');
      window.setTimeout(() => {
        history.replace('/');
        onOpenLogin?.();
      }, 700);
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Could not verify email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="verify-email-page">
      <section className="verify-email-card">
        <p className="eyebrow">Account verification</p>
        <h1>Verify your email</h1>
        <p className={`verify-email-message ${status}`}>{message}</p>

        {status === 'loading' ? null : (
          <form className="auth-form verify-email-form" onSubmit={handleManualVerify}>
            <label>
              Verification Code
              <input
                value={manualToken}
                onChange={(event) => setManualToken(event.target.value)}
                placeholder="Enter code from email"
              />
            </label>
            <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting || !manualToken.trim()}>
              {isSubmitting ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
        )}

        <div className="verify-email-actions">
          <button type="button" className="ghost-btn" onClick={onBack}>
            Go home
          </button>
          {!currentUser ? (
            <button type="button" className="primary-btn" onClick={onOpenLogin}>
              Open login
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ResetPasswordPage({ currentUser, onResetPassword, onOpenLogin, onBack }) {
  const location = useLocation();
  const history = useHistory();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Enter a new password to reset your account password.');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('token') || '';
    setToken(t);
    if (!t) {
      setStatus('missing');
      setMessage('No reset token found in the link. Use the token from your email.');
    }
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    setPageError('');
    if (!validatePassword(newPassword)) {
      setPageError('Password must be at least 8 characters, include uppercase, lowercase, a number and a special character.');
      setStatus('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPageError('Passwords do not match.');
      setStatus('error');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus('loading');
      setMessage('Resetting password...');
      await onResetPassword(token, newPassword);
      const successMessage = 'Password reset successful. Please log in.';
      setStatus('success');
      setMessage(successMessage);
      window.localStorage.setItem(STORAGE_KEYS.authFlash, successMessage);
      window.localStorage.setItem(STORAGE_KEYS.authFlashMode, 'login');
      window.setTimeout(() => {
        history.replace('/');
        onOpenLogin?.();
      }, 700);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Could not reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validatePassword = (pw) => {
    if (!pw || pw.length < 8) return false;
    const upper = /[A-Z]/.test(pw);
    const lower = /[a-z]/.test(pw);
    const number = /[0-9]/.test(pw);
    const special = /[^A-Za-z0-9]/.test(pw);
    return upper && lower && number && special;
  };

  return (
    <main className="verify-email-page">
      <section className="verify-email-card">
        <p className="eyebrow">Password reset</p>
        <h1>Reset your password</h1>
        <p className={`verify-email-message ${status}`}>{message}</p>

        <form className="auth-form verify-email-form" onSubmit={handleSubmit}>
          {pageError ? <div className="auth-error">{pageError}</div> : null}
          <label>
            New password
            <div className="password-field">
              <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
              <button type="button" className="password-toggle" onClick={() => setShowNewPassword((s) => !s)} aria-label="Toggle password visibility">{showNewPassword ? '🙈' : '👁️'}</button>
            </div>
          </label>
          <label>
            Confirm password
            <div className="password-field">
              <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
              <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((s) => !s)} aria-label="Toggle password visibility">{showConfirmPassword ? '🙈' : '👁️'}</button>
            </div>
          </label>
          <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting || !token}>
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="verify-email-actions">
          <button type="button" className="ghost-btn" onClick={onBack}>Go home</button>
          {!currentUser ? (
            <button type="button" className="primary-btn" onClick={onOpenLogin}>Open login</button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function HomePage({ products, categories, newArrivals, currentUser, onAddToCart, onOpenDetails, onRequestLogin, onRequestSignup, cart, onCheckout, onRemoveFromCart, getAverageRating, getRatingCount, heroImages, searchTerm, onSearchTermChange }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const heroRef = useRef(null);
  const collectionsRef = useRef(null);
  const scrollerRef = useRef(null);
  const allSareesRef = useRef(null);

  useScrollReveal(heroRef, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  useScrollReveal(collectionsRef, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  useScrollReveal(scrollerRef, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  useScrollReveal(allSareesRef, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  const priceRanges = [
    { id: 'all', label: 'All prices' },
    { id: 'under2000', label: 'Under ₹2,000', min: 0, max: 2000 },
    { id: '2000to3000', label: '₹2,000–₹3,000', min: 2000, max: 3000 },
    { id: 'above3000', label: 'Above ₹3,000', min: 3000 }
  ];

  const selectedPrice = priceRanges.find((range) => range.id === selectedPriceRange) || priceRanges[0];
  const visibleCollections = selectedCategory
    ? products.filter((product) => String(product.category || '').trim().toLowerCase() === selectedCategory.trim().toLowerCase())
    : products;

  const priceFilteredCollections = visibleCollections.filter((product) => {
    const price = Number(product.price || 0);
    if (!selectedPrice || selectedPrice.id === 'all') return true;
    if (selectedPrice.max != null) {
      return price >= (selectedPrice.min || 0) && price <= selectedPrice.max;
    }
    return price >= (selectedPrice.min || 0);
  });

  const handleSelectCategory = (categoryName) => {
    setSelectedCategory((prev) => (prev && prev.trim().toLowerCase() === String(categoryName).trim().toLowerCase() ? '' : categoryName));
    window.setTimeout(() => {
      document.getElementById('all-sarees')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const handleShopNow = () => {
    const section = document.getElementById('collections');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main>
      <div ref={heroRef} className="reveal">
        {/* Only pass allowed local images to the hero (filter by filename) */}
        {(() => {
          const filtered = (heroImages || []).filter((img) => {
            try {
              const parts = String(img || '').split('/');
              const name = parts[parts.length - 1];
              return ALLOWED_HERO_FILENAMES.includes(name);
            } catch (e) {
              return false;
            }
          });

          // If none of the configured hero images match, fall back to the allowed set (served from public root)
          const fallback = ALLOWED_HERO_FILENAMES.map((f) => `/${f}`);
          const toUse = filtered.length ? filtered : fallback;

          return <BackgroundHero images={toUse} onShopNow={handleShopNow} />;
        })()}
      </div>

      <section className="hero-actions">
        {currentUser?.role === 'user' ? (
          <p className="auth-note">You are signed in as a shopper. Add items to cart or book directly.</p>
        ) : hasBackOfficeAccess(currentUser?.role) ? (
          <p className="auth-note">{currentUser?.role === 'staff' ? 'Staff mode is active. Use the dashboard to update shipments.' : 'Admin mode is active. Use the dashboard to add or edit sarees.'}</p>
        ) : (
          <div className="auth-note">
            <span>Login or sign up to add sarees to cart and book them.</span>
            <div className="auth-note-actions">
              <button className="primary-btn" onClick={onRequestLogin}>Login</button>
              <button className="ghost-btn" onClick={onRequestSignup}>Sign Up</button>
            </div>
          </div>
        )}
      </section>

      <section className="storefront-filters">
        <div className="storefront-filters-row">
          <label className="storefront-search-field">
            Search sarees
            <input
              type="search"
              placeholder="Search by name, category, or fabric"
              value={searchTerm || ''}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </label>
          <div className="price-filter-group" role="group" aria-label="Filter by price range">
            {priceRanges.map((range) => (
              <button
                key={range.id}
                type="button"
                className={`filter-chip ${selectedPriceRange === range.id ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(range.id)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div id="collections" ref={collectionsRef} className="reveal">
        <SareeGrid
          title="New Arrivals"
          sarees={newArrivals}
          onAdd={onAddToCart}
          onOpenDetails={onOpenDetails}
          getAverageRating={getAverageRating}
          getRatingCount={getRatingCount}
        />
      </div>

      <div id="category" ref={scrollerRef} className="reveal">
        <CollectionScroller collections={categories} title="Browse Saree Categories" onSelectCategory={handleSelectCategory} activeCategory={selectedCategory} />
      </div>

      <div id="all-sarees" ref={allSareesRef} className="reveal">
      <SareeGrid
        title={selectedCategory ? `${selectedCategory} Sarees` : 'All Sarees'}
        sarees={priceFilteredCollections}
        onAdd={onAddToCart}
        onOpenDetails={onOpenDetails}
        getAverageRating={getAverageRating}
        getRatingCount={getRatingCount}
      />
      </div>

      <section className="booking-strip">
        <div>
          <h3>Ready to book your saree?</h3>
          <p>Open any product for full details, then add to cart or book instantly.</p>
        </div>
        <button className="primary-btn" onClick={onCheckout}>Book Cart</button>
      </section>
    </main>
  );
}

function SareeDetailPage({ products, currentUser, onBack, onAddToCart, onBookProduct, onRequestLogin, getAverageRating, getRatingCount }) {
  const { id } = useParams();
  const product = products.find((item) => String(item.id) === String(id));
  const galleryImages = useMemo(() => {
    if (!product) {
      return [FALLBACK_PRODUCT_IMAGE];
    }

    const source = Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image || FALLBACK_PRODUCT_IMAGE];

    return source.filter(Boolean);
  }, [product]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsWishlisted(false);
    setIsShareOpen(false);
  }, [id]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = product
    ? `Check out ${product.name} on Samruddhi Saree Collections: ${shareUrl}`
    : shareUrl;

  const handleShare = async (network) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    if (network === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer');
      return;
    }

    if (network === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener,noreferrer');
      return;
    }

    if (network === 'instagram') {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
        } catch (error) {
          // ignore clipboard failures and still open Instagram
        }
      }
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      return;
    }
  };

  const handleImageError = (event) => {
    event.currentTarget.src = `https://picsum.photos/seed/detail-${id}/900/1200`;
  };

  if (!product) {
    return (
      <section className="detail-page">
        <button className="ghost-btn" onClick={onBack}>Back</button>
        <h1 className="detail-title">Saree not found</h1>
      </section>
    );
  }

  return (
    <section className="detail-page">
      <button className="ghost-btn" onClick={onBack}>Back to collections</button>

      <div className="detail-layout">
        <div className="detail-gallery">
          <img src={galleryImages[activeImageIndex] || FALLBACK_PRODUCT_IMAGE} alt={product.name} className="detail-image" onError={handleImageError} />
          {galleryImages.length > 1 ? (
            <div className="detail-thumbnail-row">
              {galleryImages.map((image, index) => (
                <button
                  key={`${product.id}-thumb-${index}`}
                  type="button"
                  className={`detail-thumb-btn ${index === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(index)}
                >
                  <img src={image} alt={`${product.name} view ${index + 1}`} onError={handleImageError} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="detail-mini-row">
            <div className="detail-mini-card">{product.category}</div>
            <div className="detail-mini-card">₹{product.price.toLocaleString()}</div>
            {getAverageRating(product.id) > 0 && <div className="detail-mini-card">★ {getAverageRating(product.id).toFixed(1)} ({getRatingCount(product.id)} ratings)</div>}
          </div>
        </div>

        <div className="detail-summary">
          {product.isNew ? <span className="detail-badge">New Arrival</span> : null}
          <h1 className="detail-title">{product.name}</h1>
          <p className="detail-subtitle">{product.description}</p>
          <div className="detail-price">₹{product.price.toLocaleString()}</div>

          <div className="detail-meta-grid">
            <div><span>Fabric</span><strong>{product.fabric}</strong></div>
            <div><span>Category</span><strong>{product.category}</strong></div>
          </div>

          <div className="detail-actions">
            <button className="primary-btn" onClick={() => onAddToCart(product)}>Add to Cart</button>
            <button className="ghost-btn" onClick={() => onBookProduct(product)}>Book Now</button>
            <button
              type="button"
              className="icon-action-btn"
              aria-label="Share product"
              title="Share"
              onClick={() => setIsShareOpen((value) => !value)}
            >
              <i className="fas fa-rocket" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`icon-action-btn ${isWishlisted ? 'active' : ''}`}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              title="Wishlist"
              onClick={() => setIsWishlisted((value) => !value)}
            >
              <i className={isWishlisted ? 'fas fa-heart' : 'far fa-heart'} aria-hidden="true" />
            </button>
          </div>

          {isShareOpen ? (
            <div className="share-popover" role="group" aria-label="Share options">
              <button type="button" className="share-icon-btn whatsapp" onClick={() => handleShare('whatsapp')} aria-label="Share on WhatsApp" title="WhatsApp">
                <i className="fab fa-whatsapp" aria-hidden="true" />
              </button>
              <button type="button" className="share-icon-btn instagram" onClick={() => handleShare('instagram')} aria-label="Share on Instagram" title="Instagram">
                <i className="fab fa-instagram" aria-hidden="true" />
              </button>
              <button type="button" className="share-icon-btn facebook" onClick={() => handleShare('facebook')} aria-label="Share on Facebook" title="Facebook">
                <i className="fab fa-facebook-f" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {currentUser?.role !== 'user' ? (
            <div className="auth-note detail-auth-note">
              <span>Login to add to cart and book.</span>
              <button className="primary-btn" onClick={onRequestLogin}>Login</button>
            </div>
          ) : null}

          <div className="detail-sections-inline">
            <section>
              <h2>Highlights</h2>
              <ul>
                {product.details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Style Notes</h2>
              <p>
                This saree is designed to stand out with elegant drape, rich texture, and a festive finish.
                Pair it with a contrasting blouse and statement jewelry for a polished look.
              </p>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminPanelPage({ section = 'profile', products, currentUser, onUpdateProfile, onAddProduct, onEditProduct, onRemoveProduct, allBookings = [], onApproveBooking, onRejectBooking, onUpdateShipment, onNotify, heroImages = [], onUpdateHeroImages, onCreateStaff }) {
  const active = ADMIN_SECTION_META[section] || ADMIN_SECTION_META.profile;
  const isAdminUser = currentUser?.role === 'admin';
  const isStaffUser = currentUser?.role === 'staff';
  const showSidebar = !['profile', 'orders', 'collection'].includes(section);
  const history = useHistory();
  const adminSectionItems = [
    { key: 'profile', label: 'Profile' },
    { key: 'orders', label: 'Order Track' },
    ...(isAdminUser ? [
      { key: 'returns', label: 'Returns' },
      { key: 'collection', label: 'Manage Collection' },
      { key: 'uploads', label: 'Uploads' }
    ] : [])
  ];
  const dashboardLabel = isStaffUser ? 'Staff dashboard' : 'Admin dashboard';
  const roleLabel = isStaffUser ? 'Staff' : 'Administrator';
  const accessLabel = isStaffUser ? 'Order management' : 'Store management';
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name || '',
    email: currentUser.email || '',
    phone: currentUser.phone || ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [orderView, setOrderView] = useState('history');
  const [historySearch, setHistorySearch] = useState('');
  const [historyMonth, setHistoryMonth] = useState('all');
  const [historyDay, setHistoryDay] = useState('all');
  const [historyCategory, setHistoryCategory] = useState('all');
  const [historyRate, setHistoryRate] = useState('');
  const [historyFilterMode, setHistoryFilterMode] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [collectionQuery, setCollectionQuery] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState(() => ({ ...DEFAULT_NEW_PRODUCT }));
  const [isImageDragActive, setIsImageDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputClickTimeRef = useRef(0);

  const handleFileInputClick = () => {
    const now = Date.now();
    // Debounce: prevent clicks within 500ms of the last click
    if (now - fileInputClickTimeRef.current < 500) {
      return;
    }
    fileInputClickTimeRef.current = now;
    fileInputRef.current?.click();
  };

  useEffect(() => {
    setProfileForm({
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || ''
    });
  }, [currentUser]);

  const totalStock = products.reduce((sum, product) => sum + (product.stock || 0), 0);
  const inventoryValue = products.reduce((sum, product) => sum + (product.price * (product.stock || 0)), 0);
  const recent30 = (() => {
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const recent = allBookings.filter((booking) => new Date(booking.bookedAt).getTime() >= cutoff);
    return {
      count: recent.length,
      revenue: recent.reduce((sum, booking) => sum + (Number(booking.price || 0) * (booking.qty || 1)), 0)
    };
  })();

  const approvedBookings = allBookings.filter((b) => b.status === 'confirmed');
  const verificationBookings = allBookings.filter((b) => b.status === 'verification_in_process');

  const bookingHistoryCategories = useMemo(() => {
    const categorySet = new Set();
    approvedBookings.forEach((booking) => {
      const name = String(booking.category || booking.name || '').trim();
      if (name) {
        categorySet.add(name);
      }
    });
    return ['all', ...Array.from(categorySet)];
  }, [approvedBookings]);

  const filteredHistoryBookings = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    const rateLimit = historyRate === '' ? null : Number(historyRate);

    return approvedBookings.filter((booking) => {
      const submittedAt = booking.submittedAt || booking.bookedAt || '';
      const date = submittedAt ? new Date(submittedAt) : null;
      const month = date ? date.getMonth() + 1 : null;
      const day = date ? date.getDate() : null;
      const category = String(booking.category || booking.name || '').trim().toLowerCase();
      const amount = Number(booking.price || 0) * Number(booking.qty || 1);
      const haystack = [booking.name, booking.userName, booking.userEmail, booking.category, booking.paymentId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !term || haystack.includes(term);
      const matchesMonth = historyFilterMode === 'month' ? historyMonth === 'all' || month === Number(historyMonth) : true;
      const matchesDay = historyFilterMode === 'day' ? historyDay === 'all' || day === Number(historyDay) : true;
      const matchesCategory = historyFilterMode === 'category' ? historyCategory === 'all' || category.includes(historyCategory.toLowerCase()) : true;
      const matchesRate = historyFilterMode === 'rate' ? (rateLimit === null || amount >= rateLimit) : true;

      return matchesSearch && matchesMonth && matchesDay && matchesCategory && matchesRate;
    });
  }, [approvedBookings, historyCategory, historyDay, historyFilterMode, historyMonth, historyRate, historySearch]);

  const collectionCategories = useMemo(() => {
    const categorySet = new Set(seedCategories.map((category) => category.name));
    products.forEach((product) => {
      const nextCategory = String(product.category || '').trim();
      if (nextCategory) {
        categorySet.add(nextCategory);
      }
    });

    return ['all', ...Array.from(categorySet)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = collectionQuery.trim().toLowerCase();

    return products.filter((product) => {
      const inCategory = categoryFilter === 'all' || String(product.category || '').trim().toLowerCase() === categoryFilter.trim().toLowerCase();
      if (!inCategory) {
        return false;
      }

      if (!term) {
        return true;
      }

      const source = [product.name, product.category, product.fabric, product.description].join(' ').toLowerCase();
      return source.includes(term);
    });
  }, [products, categoryFilter, collectionQuery]);

  useEffect(() => {
    if (editingProductId || categoryFilter === 'all') {
      return;
    }

    setProductForm((prev) => ({ ...prev, category: categoryFilter }));
  }, [categoryFilter, editingProductId]);

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    onUpdateProfile?.({
      name: profileForm.name.trim() || currentUser.name,
      email: profileForm.email.trim() || currentUser.email,
      phone: profileForm.phone.trim()
    });
    setIsEditingProfile(false);
  };

  const resetCollectionForm = () => {
    setEditingProductId(null);
    setIsImageDragActive(false);
    setProductForm({
      ...DEFAULT_NEW_PRODUCT,
      category: categoryFilter !== 'all' ? categoryFilter : DEFAULT_NEW_PRODUCT.category
    });
  };

  const uploadCollectionImages = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type?.startsWith('image/'));
    if (!files.length) {
      return;
    }

    const encoded = await Promise.all(
      files.map((file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      }))
    );

    const nextImages = encoded.filter(Boolean);
    if (!nextImages.length) {
      return;
    }

    setProductForm((prev) => {
      const existingImages = Array.isArray(prev.images) ? prev.images : [];
      // Deduplicate by checking if image data already exists
      const uniqueNewImages = nextImages.filter(
        (newImg) => !existingImages.includes(newImg)
      );
      
      if (uniqueNewImages.length === 0) {
        return prev; // No new unique images to add
      }
      
      const mergedImages = [...existingImages, ...uniqueNewImages].slice(0, 8);
      return {
        ...prev,
        images: mergedImages
      };
    });
    
    // Clear file input to prevent re-processing
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeCollectionImage = (indexToRemove) => {
    setProductForm((prev) => ({
      ...prev,
      images: (Array.isArray(prev.images) ? prev.images : []).filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmitRating = (bookingId, productId, ratingValue, reviewText) => {
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      addToast('Please select a rating between 1 and 5', 'error');
      return;
    }

    const newRating = {
      id: `${Date.now()}-${Math.random()}`,
      bookingId,
      productId,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userName: currentUser?.name,
      rating: Number(ratingValue),
      review: reviewText?.trim() || '',
      createdAt: new Date().toISOString()
    };

    setRatings(prev => [...prev, newRating]);
    addToast('Thank you for your rating!', 'success');
  };

  const handleCollectionSubmit = (event) => {
    event.preventDefault();

    const payload = {
      ...productForm,
      name: productForm.name.trim() || `${normalizeCategoryName(productForm.category, products)} Saree`,
      description: productForm.description.trim(),
      images: (Array.isArray(productForm.images) ? productForm.images : []).filter(Boolean),
      category: normalizeCategoryName(productForm.category, products),
      fabric: productForm.fabric.trim(),
      price: Number(productForm.price || 0),
      stock: Number(productForm.stock || 0)
    };

    payload.image = payload.images[0] || FALLBACK_PRODUCT_IMAGE;

    if (!payload.name || !payload.category || payload.price <= 0) {
      return;
    }

    if (editingProductId) {
      onEditProduct?.({ ...payload, id: editingProductId });
      onNotify('Product updated successfully', 'success');
    } else {
      onAddProduct?.(payload);
      onNotify('Product added successfully', 'success');
    }

    resetCollectionForm();
    // Show all categories after adding/editing to ensure product is visible
    setCategoryFilter('all');
  };

  const beginEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      ...DEFAULT_NEW_PRODUCT,
      name: product.name || '',
      price: String(product.price || ''),
      images: Array.isArray(product.images) && product.images.length
        ? product.images
        : product.image
          ? [product.image]
          : [],
      description: product.description || '',
      category: product.category || DEFAULT_NEW_PRODUCT.category,
      fabric: product.fabric || '',
      stock: String(product.stock ?? 0),
      isNew: Boolean(product.isNew)
    });
  };

  return (
    <section className="admin-page">
      <div className="admin-hero">
        <div className="admin-hero-copy">
            <p className="eyebrow">{dashboardLabel}</p>
          <h1>{active.title}</h1>
          <p>{active.description} Signed in as {currentUser.name}.</p>
          <div className="admin-hero-meta">
            <span className="admin-meta-pill">Live catalog</span>
            <span className="admin-meta-pill">Secure session</span>
              <span className="admin-meta-pill">{isStaffUser ? 'Shipment updates' : 'Owner verification'}</span>
          </div>
        </div>
        <div className="admin-hero-actions">
          <div className="admin-hero-badge">
              <span className="admin-hero-badge-label">Active {isStaffUser ? 'staff' : 'admin'}</span>
            <strong>{currentUser.name}</strong>
          </div>
          <Link className="primary-btn" to="/">Back to Store</Link>
        </div>
      </div>

      <div className="admin-content">
        <div className={`admin-panel-grid${showSidebar ? '' : ' admin-panel-grid--no-sidebar'}`}>
          {showSidebar ? (
            <aside className="admin-panel-sidebar">
              <div className="admin-sidebar-header">
                <p className="eyebrow">Quick access</p>
                <h3>Dashboard Menu</h3>
              </div>
              {adminSectionItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`admin-sidebar-link ${section === item.key ? 'active' : ''}`}
                  onClick={() => history.push(`/admin/${item.key}`)}
                >
                  {item.label}
                </button>
              ))}
            </aside>
          ) : null}

          <div className="admin-panel-main">
            {section === 'profile' ? (
              <section className="admin-section-card admin-panel-page-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Profile</p>
                <h2>Admin information</h2>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  if (isEditingProfile) {
                    setProfileForm({
                      name: currentUser.name || '',
                      email: currentUser.email || '',
                      phone: currentUser.phone || ''
                    });
                  }
                  setIsEditingProfile((value) => !value);
                }}
              >
                {isEditingProfile ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {isEditingProfile ? (
              <form className="profile-form admin-profile-form" onSubmit={handleProfileSubmit}>
                <label>
                  Display Name
                  <input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} required />
                </label>
                <label>
                  Email Address
                  <input type="email" value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} required />
                </label>
                <label>
                  Phone Number
                  <input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} />
                </label>
                <div className="detail-actions">
                  <button className="primary-btn" type="submit">Save Profile</button>
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => {
                      setProfileForm({
                        name: currentUser.name || '',
                        email: currentUser.email || '',
                        phone: currentUser.phone || ''
                      });
                      setIsEditingProfile(false);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            ) : (
              <>
              <div className="profile-display admin-profile-summary">
                <div className="profile-item"><span className="profile-label">Name</span><span className="profile-value">{currentUser.name}</span></div>
                <div className="profile-item"><span className="profile-label">Email</span><span className="profile-value">{currentUser.email}</span></div>
                <div className="profile-item"><span className="profile-label">Phone</span><span className="profile-value">{currentUser.phone || 'Not added'}</span></div>
                <div className="profile-item"><span className="profile-label">Role</span><span className="profile-value">{roleLabel}</span></div>
                <div className="profile-item"><span className="profile-label">Access</span><span className="profile-value">{accessLabel}</span></div>
                <div className="profile-item"><span className="profile-label">Admin ID</span><span className="profile-value">{currentUser.id || 'admin-account'}</span></div>
              </div>
              </>
            )}
          </section>
        ) : null}

        {section === 'orders' ? (
          <>
            <section className="admin-section-card admin-panel-page-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Orders</p>
                  <h2>Order tracking</h2>
                </div>
              </div>
              <div className="analytics-summary">
                <div className="analytic-card"><div className="analytic-value">{recent30.count}</div><div className="analytic-label">Sales (30 days)</div></div>
                <div className="analytic-card"><div className="analytic-value">₹{(recent30.revenue || 0).toLocaleString()}</div><div className="analytic-label">Revenue (30 days)</div></div>
              </div>
            </section>

            <section id="admin-orders" className="orders-panel admin-section-card">
              <div className="section-header section-header-tight">
                <div>
                  <p className="eyebrow">Bookings</p>
                  <h2>Order Track</h2>
                </div>
              </div>

              <div className="admin-order-tabs" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button type="button" className={`ghost-btn ${orderView === 'history' ? 'active' : ''}`} onClick={() => setOrderView('history')}>Booking History</button>
                <button type="button" className={`ghost-btn ${orderView === 'verification' ? 'active' : ''}`} onClick={() => setOrderView('verification')}>Verification</button>
              </div>

              {orderView === 'history' ? (
                <>
                  <div className="collection-toolbar" style={{ marginBottom: '1rem' }}>
                    <label>
                      Search
                      <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search by name, user, category, ID" />
                    </label>
                    <label>
                      Filter by
                      <select value={historyFilterMode} onChange={(event) => setHistoryFilterMode(event.target.value)}>
                        <option value="all">All Filters</option>
                        <option value="month">Month</option>
                        <option value="day">Day</option>
                        <option value="category">Category</option>
                        <option value="rate">Rate</option>
                      </select>
                    </label>
                    {historyFilterMode === 'month' ? (
                      <label>
                        Month
                        <select value={historyMonth} onChange={(event) => setHistoryMonth(event.target.value)}>
                          <option value="all">All Months</option>
                          {Array.from(new Set(approvedBookings.map((booking) => new Date(booking.submittedAt || booking.bookedAt).getMonth() + 1))).sort((a, b) => a - b).map((month) => (
                            <option key={month} value={month}>{new Date(2026, month - 1, 1).toLocaleString('en-IN', { month: 'long' })}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {historyFilterMode === 'day' ? (
                      <label>
                        Day
                        <select value={historyDay} onChange={(event) => setHistoryDay(event.target.value)}>
                          <option value="all">All Days</option>
                          {Array.from(new Set(approvedBookings.map((booking) => new Date(booking.submittedAt || booking.bookedAt).getDate()))).sort((a, b) => a - b).map((day) => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {historyFilterMode === 'category' ? (
                      <label>
                        Category
                        <select value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}>
                          {bookingHistoryCategories.map((category) => (
                            <option key={category} value={category}>{category === 'all' ? 'All Categories' : category}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {historyFilterMode === 'rate' ? (
                      <label>
                        Min Rate
                        <input type="number" min="0" value={historyRate} onChange={(event) => setHistoryRate(event.target.value)} placeholder="₹ min" />
                      </label>
                    ) : null}
                  </div>

                  <div className="section-header section-header-tight">
                    <div>
                      <p className="eyebrow">History</p>
                      <h2>Booking History ({filteredHistoryBookings.length})</h2>
                    </div>
                  </div>
                  {filteredHistoryBookings.length === 0 ? (
                    <p>No booking history matches the current filters.</p>
                  ) : (
                    <div className="orders-list">
                      {filteredHistoryBookings.map((booking) => {
                    const tracking = buildOrderTrackingInfo(booking);
                    const bookingDateTime = formatDateTime(booking.submittedAt || booking.bookedAt);
                    const amount = Number(booking.price || 0) * Number(booking.qty || 1);
                    const statusLabel = booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1) || 'Pending';

                    return (
                      <article key={booking.id} className="order-card admin-order-card order-card-creative">
                        <div className="order-card-top">
                          <div className="order-card-title-block">
                            <p className="order-card-kicker">Booking #{String(booking.id).slice(-8)}</p>
                            <h3>{booking.name}</h3>
                            <p className="order-card-subtitle">Placed by {booking.userName || 'N/A'} on {bookingDateTime}</p>
                          </div>
                          <span className={`order-status ${booking.status}`}>{statusLabel}</span>
                        </div>

                        <div className="order-highlight-band">
                          <div className="order-highlight-card accent">
                            <span>Days to Reach</span>
                            <strong>{tracking.daysToReach} days</strong>
                          </div>
                          <div className="order-highlight-card">
                            <span>Delivery Time</span>
                            <strong>{tracking.estimatedDeliveryHours} hrs</strong>
                          </div>
                          <div className="order-highlight-card">
                            <span>Time Taken So Far</span>
                            <strong>{tracking.elapsedHours} hrs</strong>
                          </div>
                          <div className="order-highlight-card amount">
                            <span>Amount</span>
                            <strong>₹{amount.toLocaleString()}</strong>
                          </div>
                        </div>

                        <div className="order-detail-grid">
                          <div className="order-metric-card">
                            <span>Booked At</span>
                            <strong>{bookingDateTime}</strong>
                          </div>
                          <div className="order-metric-card">
                            <span>Payment Time</span>
                            <strong>{booking.paymentTime || 'N/A'}</strong>
                          </div>
                          <div className="order-metric-card">
                            <span>Expected Delivery</span>
                            <strong>{tracking.estimatedDeliveryAt.toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="order-metric-card">
                            <span>Tracking Status</span>
                            <strong>{booking.status || 'pending'}</strong>
                          </div>
                        </div>

                        <div className="order-contact-strip">
                          <div>
                            <span>User</span>
                            <strong>{booking.userName || 'N/A'}</strong>
                          </div>
                          <div>
                            <span>Email</span>
                            <strong>{booking.userEmail || 'N/A'}</strong>
                          </div>
                          <div>
                            <span>Payment ID</span>
                            <strong>{booking.paymentId || 'N/A'}</strong>
                          </div>
                        </div>

                        {booking.screenshot ? (
                          <div className="screenshot-view creative-screenshot-view">
                            <div className="screenshot-header"></div>
                            <img
                              src={resolveImageSource(booking.screenshot, FALLBACK_PRODUCT_IMAGE)}
                              alt="Payment screenshot"
                              className="order-screenshot"
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                              }}
                            />
                          </div>
                        ) : null}

                        <div className="shipment-actions">
                          <div className="shipment-status-info">
                            <span className="shipment-label">Shipment Status:</span>
                            <span className={`shipment-badge ${booking.shipmentStatus}`}>{booking.shipmentStatus}</span>
                          </div>
                          <div className="shipment-buttons">
                            {isStaffUser && booking.shipmentStatus === 'pending' && (
                              <button 
                                className="shipment-btn shipped-btn" 
                                onClick={() => onUpdateShipment(booking.id, 'shipped')}
                              >
                                📦 Mark as Shipped
                              </button>
                            )}
                            {isStaffUser && (booking.shipmentStatus === 'pending' || booking.shipmentStatus === 'shipped') && (
                              <button 
                                className="shipment-btn delivered-btn" 
                                onClick={() => onUpdateShipment(booking.id, 'delivered')}
                              >
                                ✓ Mark as Delivered
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </section>

            {isAdminUser ? (
              <section id="admin-verification" className="verification-panel admin-section-card" style={{ display: orderView === 'verification' ? 'block' : 'none' }}>
                <h2>Verification</h2>
                {verificationBookings.length === 0 ? (
                  <p>No orders pending verification.</p>
                ) : (
                  <div className="pending-orders-list">
                    {verificationBookings.map((order) => {
                      const bookingDateTime = formatDateTime(order.submittedAt || order.bookedAt);
                      return (
                        <div key={order.id} className="pending-order-item">
                          <div className="order-header"><span className="order-id">{order.name}</span><span className="order-status">Pending Verification</span></div>
                          <div className="order-details">
                            <p><strong>User:</strong> {order.userName || 'N/A'}</p>
                            <p><strong>Email:</strong> {order.userEmail || 'N/A'}</p>
                            <p><strong>Payment ID:</strong> {order.paymentId || 'N/A'}</p>
                            <p><strong>Payment Time:</strong> {order.paymentTime || bookingDateTime}</p>
                            <p><strong>Submitted:</strong> {bookingDateTime}</p>
                            <p><strong>Days to Reach:</strong> {buildOrderTrackingInfo(order).daysToReach} days</p>
                            <p><strong>Delivery Time:</strong> {buildOrderTrackingInfo(order).estimatedDeliveryHours} hrs</p>
                          </div>
                          {order.paymentScreenshot ? <div className="screenshot-view"><img src={resolveImageSource(order.paymentScreenshot, FALLBACK_PRODUCT_IMAGE)} alt="Payment screenshot" className="order-screenshot" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_PRODUCT_IMAGE; }} /></div> : null}
                          <div className="verification-actions">
                            <button 
                              className="verify-btn approve-btn" 
                              disabled={order.status !== 'verification_in_process'}
                              onClick={() => onApproveBooking(order.id)}
                            >
                              ✓ Approve
                            </button>
                            <button 
                              className="verify-btn reject-btn" 
                              disabled={order.status !== 'verification_in_process'}
                              onClick={() => onRejectBooking(order.id)}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}
          </>
        ) : null}

        {section === 'collection' && isAdminUser ? (
          <section className="admin-section-card admin-panel-page-card collection-manager-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Collection Studio</p>
                <h2>Manage Sarees by Category</h2>
                <p className="collection-subtitle">Create, update, and remove sarees. Changes are applied to both the storefront and user dashboards instantly.</p>
              </div>
            </div>

            <div className="collection-toolbar">
              <label>
                Category
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  {collectionCategories.map((categoryName) => (
                    <option key={categoryName} value={categoryName}>
                      {categoryName === 'all' ? 'All Categories' : categoryName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="collection-search-field">
                Search Sarees
                <input
                  type="text"
                  placeholder="Search by name, category, fabric..."
                  value={collectionQuery}
                  onChange={(event) => setCollectionQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="collection-manager-grid">
              <form className="collection-form" onSubmit={handleCollectionSubmit}>
                <div className="collection-form-header">
                  <h3>{editingProductId ? 'Edit Saree' : 'Add New Saree'}</h3>
                  {editingProductId ? (
                    <button type="button" className="ghost-btn" onClick={resetCollectionForm}>Cancel Edit</button>
                  ) : null}
                </div>

                <div className="collection-form-grid">
                  <label>
                    Category
                    <input
                      value={productForm.category}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))}
                      placeholder="Silk"
                      required
                    />
                  </label>
                  <label>
                    Price (INR)
                    <input
                      type="number"
                      min="1"
                      value={productForm.price}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Stock
                    <input
                      type="number"
                      min="0"
                      value={productForm.stock}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, stock: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Fabric
                    <input
                      value={productForm.fabric}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, fabric: event.target.value }))}
                    />
                  </label>
                  <div className="full-width collection-photos-field">
                    <span>Saree Photos</span>
                    <div
                      className={`image-dropzone ${isImageDragActive ? 'drag-over' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={handleFileInputClick}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleFileInputClick();
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsImageDragActive(true);
                      }}
                      onDragLeave={() => setIsImageDragActive(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsImageDragActive(false);
                        uploadCollectionImages(event.dataTransfer.files);
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(event) => {
                          uploadCollectionImages(event.target.files);
                          event.target.value = '';
                        }}
                      />
                      <div className="dropzone-content">
                        <p>Drop images here or click to browse</p>
                        <p className="text-muted">Multiple photos supported, up to 8 images per saree.</p>
                      </div>
                    </div>
                    {Array.isArray(productForm.images) && productForm.images.length ? (
                      <div className="collection-upload-preview-list">
                        {productForm.images.map((image, index) => (
                          <div className="collection-upload-preview" key={`preview-${index}`}>
                            <img src={image} alt={`Preview ${index + 1}`} />
                            <button
                              type="button"
                              className="collection-remove-image"
                              onClick={() => removeCollectionImage(index)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <label className="full-width">
                    Description
                    <textarea
                      rows={3}
                      value={productForm.description}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </label>
                  <label className="collection-checkbox-row full-width">
                    <input
                      type="checkbox"
                      checked={productForm.isNew}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, isNew: event.target.checked }))}
                    />
                    Mark as New Arrival
                  </label>
                </div>

                <div className="collection-form-actions">
                  <button type="submit" className="primary-btn">{editingProductId ? 'Save Changes' : 'Add Saree'}</button>
                  <button type="button" className="ghost-btn" onClick={resetCollectionForm}>Reset</button>
                </div>
              </form>

              <div className="collection-list-panel">
                <div className="collection-list-header">
                  <h3>Available Sarees</h3>
                  <span>{filteredProducts.length} items</span>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="collection-empty-state">
                    <p>No sarees found for this filter.</p>
                  </div>
                ) : (
                  <div className="collection-card-list">
                    {filteredProducts.map((product, index) => (
                      <article className="collection-item-card" key={product.id} style={{ animationDelay: `${index * 0.05}s` }}>
                        <img
                          src={(Array.isArray(product.images) && product.images[0]) || product.image}
                          alt={product.name}
                          onError={(event) => {
                            event.currentTarget.src = 'https://images.unsplash.com/photo-1610684537529-15f1e50c8767?w=400&h=500&fit=crop';
                          }}
                        />
                        <div className="collection-item-copy">
                          <p className="collection-chip">{product.category}</p>
                          <h4>{product.name}</h4>
                          <p>{product.description || 'Elegant drape, festive finish.'}</p>
                          <div className="collection-item-meta">
                            <strong>₹{Number(product.price || 0).toLocaleString()}</strong>
                            <span>Stock: {Number(product.stock || 0)}</span>
                            <span>★ {Number(product.rating || 0).toFixed(1)}</span>
                            <span>{Array.isArray(product.images) ? product.images.length : 1} photos</span>
                          </div>
                        </div>
                        <div className="collection-item-actions">
                          <button type="button" className="ghost-btn" onClick={() => beginEditProduct(product)}>Edit</button>
                          <button
                            type="button"
                            className="ghost-btn danger"
                            onClick={() => {
                              if (window.confirm(`Remove ${product.name} from collection?`)) {
                                onRemoveProduct?.(product.id);
                                if (String(editingProductId) === String(product.id)) {
                                  resetCollectionForm();
                                }
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function RatingForm({ bookingId, productId, onSubmitRating }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmitRating(bookingId, productId, rating, review);
    setSubmitted(true);
    setTimeout(() => {
      setRating(0);
      setReview('');
      setSubmitted(false);
    }, 2000);
  };

  return (
    <div className="rating-form-section">
      <h4>⭐ Rate this saree</h4>
      {submitted ? (
        <p className="rating-success">Thank you for your rating!</p>
      ) : (
        <form onSubmit={handleSubmit} className="rating-form">
          <div className="rating-input">
            <label>Rating</label>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`star ${rating >= star ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                  title={`${star} star`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="review-input">
            <label>Review (Optional)</label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your experience with this saree..."
              maxLength={200}
              rows={3}
            />
            <small>{review.length}/200</small>
          </div>
          <button type="submit" className="primary-btn" disabled={rating === 0}>
            Submit Rating
          </button>
        </form>
      )}
    </div>
  );
}

function AuthModal({ open, mode, onClose, onSubmit, onRequestPasswordReset, onResetPassword, onVerifyEmailToken }) {
  const history = useHistory();
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPasswordToggle, setShowNewPasswordToggle] = useState(false);
  const [showConfirmPasswordToggle, setShowConfirmPasswordToggle] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    countryRegion: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    password: ''
  });
  const [activeMode, setActiveMode] = useState(mode);
  const [auxMode, setAuxMode] = useState('none');
  const [verifyToken, setVerifyToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailNotVerifiedEmail, setEmailNotVerifiedEmail] = useState('');
  const [resendFallbackToken, setResendFallbackToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    if (!open) {
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        countryRegion: '',
        address: '',
        apartment: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        password: ''
      });
      setAuxMode('none');
      setVerifyToken('');
      setResetToken('');
      setResetEmail('');
      setNewPassword('');
      setEmailNotVerifiedEmail('');
      setIsSubmitting(false);
    }
    setActiveMode(mode);
    return () => { mountedRef.current = false; };
  }, [open, mode]);

  if (!open) {
    return null;
  }

  const submit = async (event) => {
    event.preventDefault();
    setAuthError('');

    try {
      setIsSubmitting(true);

      if (auxMode === 'verify') {
        await onVerifyEmailToken?.(verifyToken.trim());
        setAuxMode('none');
        setVerifyToken('');
        setAuthError('Email verified. Please log in with your credentials.');
        setActiveMode('login');
        return;
      }

      if (auxMode === 'resend-verify') {
        if (!validateEmail(emailNotVerifiedEmail)) {
          setAuthError('Enter a valid email address');
          setIsSubmitting(false);
          return;
        }

        const data = await apiRequest('/auth/resend-verification-email', {
          method: 'POST',
          body: JSON.stringify({ email: emailNotVerifiedEmail.trim().toLowerCase() })
        });

        if (data.verificationToken) {
          setResendFallbackToken(data.verificationToken);
          setAuthError('Email delivery failed. Use the token below to verify manually.');
          setAuxMode('verify');
          setVerifyToken(data.verificationToken);
          return;
        }

        setAuthError('If the account exists, verification instructions were sent.');
        setAuxMode('none');
        setEmailNotVerifiedEmail('');
        return;
      }

      if (auxMode === 'request-reset') {
        if (!validateEmail(resetEmail)) {
          setAuthError('Enter a valid email address');
          setIsSubmitting(false);
          return;
        }
        await onRequestPasswordReset?.(resetEmail.trim().toLowerCase());
        setAuxMode('reset');
        return;
      }

      if (auxMode === 'reset') {
        if (!validatePassword(newPassword)) {
          setAuthError('Password must be at least 8 characters, include uppercase, lowercase, a number and a special character.');
          setIsSubmitting(false);
          return;
        }
        await onResetPassword?.(resetToken.trim(), newPassword);
        setAuxMode('none');
        setResetToken('');
        setNewPassword('');
        setActiveMode('login');
        history.replace('/');
        onClose();
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        return;
      }

      if (activeMode === 'signup') {
        if (!validateEmail(form.email)) {
          setAuthError('Enter a valid email address');
          setIsSubmitting(false);
          return;
        }
        if (!validatePassword(form.password)) {
          setAuthError('Password must be at least 8 characters, include uppercase, lowercase, a number and a special character.');
          setIsSubmitting(false);
          return;
        }
      }

      await onSubmit({ mode: activeMode, ...form });
    } catch (error) {
      const errorMsg = error?.message || 'Authentication failed';
      if (activeMode === 'login' && errorMsg.toLowerCase().includes('email not verified')) {
        setAuthError('Email not verified. Enter the code from your email or resend verification.');
        setEmailNotVerifiedEmail(form.email.trim().toLowerCase());
        setVerifyToken('');
        setResendFallbackToken('');
        setAuxMode('verify');
      } else {
        setAuthError(errorMsg);
      }
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  const validateEmail = (email) => {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const validatePassword = (pw) => {
    if (!pw || pw.length < 8) return false;
    const upper = /[A-Z]/.test(pw);
    const lower = /[a-z]/.test(pw);
    const number = /[0-9]/.test(pw);
    const special = /[^A-Za-z0-9]/.test(pw);
    return upper && lower && number && special;
  };

  const heading = activeMode === 'signup' ? 'Create Account' : 'Login';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="auth-header">
          <p className="eyebrow">Secure access</p>
          <h2>{heading}</h2>
          <p>
            {activeMode === 'signup'
              ? 'Create an account to book sarees and manage your orders.'
              : 'Sign in with your email and password to continue.'}
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
  
          {auxMode === 'verify' ? (
            <>
              <label>
                Verification Code
                <input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="Enter code from email" required />
              </label>
              <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting || !verifyToken.trim()}>
                {isSubmitting ? 'Verifying...' : 'Verify Email'}
              </button>
              <p className="auth-hint">
                Didn’t receive a code?{' '}
                <button type="button" className="ghost-link auth-inline-link" onClick={() => setAuxMode('resend-verify')}>
                  Resend verification code
                </button>
              </p>
            </>
          ) : null}

          {auxMode === 'resend-verify' ? (
            <>
              <p className="auth-hint">We'll send a new verification code to your email address.</p>
              <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </>
          ) : null}

          {auxMode === 'verify' && resendFallbackToken ? (
            <div className="auth-hint auth-fallback-token">
              If email fails, use this token to verify manually:
              <pre>{resendFallbackToken}</pre>
            </div>
          ) : null}

          {auxMode === 'request-reset' ? (
            <>
              <label>
                Email
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </label>
              <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting || !resetEmail.trim()}>
                {isSubmitting ? 'Sending...' : 'Send Reset Email'}
              </button>
            </>
          ) : null}

          {auxMode === 'reset' ? (
            <>
              <label>
                Reset Token (from email)
                <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
              </label>
              <label>
                New Password
                <div className="password-field">
                  <input type={showNewPasswordToggle ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                  <button type="button" className="password-toggle" onClick={() => setShowNewPasswordToggle((s) => !s)} aria-label="Toggle password visibility">
                    {showNewPasswordToggle ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>
              <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting || !resetToken.trim() || !newPassword.trim()}>
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </>
          ) : null}

          {auxMode === 'none' && activeMode === 'signup' ? (
            <div className="form-row">
              <label>
                First Name
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </label>
              <label>
                Last Name
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </label>
            </div>
          ) : null}

          {auxMode === 'none' ? (
            <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
          ) : null}

          {auxMode === 'none' && activeMode === 'signup' ? (
            <>
              <label>
                Password
                <div className="password-field">
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((s) => !s)} aria-label="Toggle password visibility">{showPassword ? '🙈' : '👁️'}</button>
                </div>
              </label>
              <label>
                Country/Region
                <input value={form.countryRegion} onChange={(e) => setForm({ ...form, countryRegion: e.target.value })} required />
              </label>
              <label>
                Apartment/Suite (Optional)
                <input value={form.apartment} onChange={(e) => setForm({ ...form, apartment: e.target.value })} />
              </label>
              <div className="form-row">
                <label>
                  City
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                </label>
                <label>
                  State
                  <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Pincode
                  <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required />
                </label>
                <label>
                  Phone
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                </label>
              </div>
            </>
          ) : auxMode === 'none' ? (
            <>
              <label>
                Password
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </label>
              {activeMode === 'login' ? (
                <button className="ghost-link auth-inline-link" type="button" onClick={() => setAuxMode('request-reset')}>
                  Forgot password?
                </button>
              ) : null}
            </>
          ) : null}

          {auxMode === 'none' ? (
            <div>
              {authError ? <div className="auth-error">{authError}</div> : null}
              <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : activeMode === 'signup' ? 'Create Account' : 'Login'}
              </button>
            </div>
          ) : null}
        </form>

        {auxMode !== 'none' ? (
          <button className="ghost-link" type="button" onClick={() => setAuxMode('none')}>
            Back to Login / Signup
          </button>
        ) : null}

        {auxMode === 'none' ? (
          <button
            className="ghost-link"
            type="button"
            onClick={() => setActiveMode(activeMode === 'login' ? 'signup' : 'login')}
          >
            {activeMode === 'login' ? 'Need an account? Switch to signup' : 'Already have an account? Switch to login'}
          </button>
        ) : null}

        {auxMode === 'none' && activeMode === 'login' ? (
          <>
            
          </>
        ) : null}
      </div>
    </div>
  );
}

function UserAccountPage({ currentUser, bookings, products, onUpdateProfile, onChangePassword, onSubmitRating, hasUserRatedBooking, onContactSupport, onBack }) {
  const [activeTab, setActiveTab] = useState('profile');
  const location = useLocation();

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab && ['profile', 'orders', 'settings'].includes(tab)) {
      setActiveTab(tab);
    } else {
      setActiveTab('profile');
    }
  }, [location.search]);

  return (
    <section className="account-page">
      <div className="account-hero">
        <div>
          <p className="eyebrow">My Account</p>
          <h1>Welcome, {currentUser.name}</h1>
          <p>Manage your profile, view orders, and update settings.</p>
        </div>
        <Link className="primary-btn" to="/">Back to Store</Link>
      </div>

      <div className="account-container">
        <div className="account-content">
          {activeTab === 'profile' && <UserProfile currentUser={currentUser} onUpdateProfile={onUpdateProfile} />}
          {activeTab === 'orders' && (
            <UserOrders
              bookings={bookings}
              products={products}
              onContactSupport={onContactSupport}
              onSubmitRating={onSubmitRating}
              hasUserRatedBooking={hasUserRatedBooking}
            />
          )}
          {activeTab === 'settings' && <UserSettings currentUser={currentUser} onChangePassword={onChangePassword} />}
        </div>
      </div>
    </section>
  );
}

function UserProfile({ currentUser, onUpdateProfile }) {
  const [form, setForm] = useState({
    firstName: currentUser.firstName || '',
    lastName: currentUser.lastName || '',
    email: currentUser.email || '',
    countryRegion: currentUser.countryRegion || '',
    address: currentUser.address || '',
    apartment: currentUser.apartment || '',
    city: currentUser.city || '',
    state: currentUser.state || '',
    pincode: currentUser.pincode || '',
    phone: currentUser.phone || ''
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.firstName.trim() && form.lastName.trim() && form.email.trim()) {
      onUpdateProfile(form);
      setIsEditing(false);
    }
  };

  return (
    <div className="account-section">
      <div className="section-header">
        <h2>Profile Information</h2>
        <button
          className={`ghost-btn ${isEditing ? 'cancel' : ''}`}
          onClick={() => {
            if (isEditing) {
              setForm({
                firstName: currentUser.firstName || '',
                lastName: currentUser.lastName || '',
                email: currentUser.email || '',
                countryRegion: currentUser.countryRegion || '',
                address: currentUser.address || '',
                apartment: currentUser.apartment || '',
                city: currentUser.city || '',
                state: currentUser.state || '',
                pincode: currentUser.pincode || '',
                phone: currentUser.phone || ''
              });
            }
            setIsEditing(!isEditing);
          }}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-row">
            <label>
              First Name
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </label>
            <label>
              Last Name
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </label>
          </div>
          <label>
            Email Address
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Country/Region
            <input
              type="text"
              value={form.countryRegion}
              onChange={(e) => setForm({ ...form, countryRegion: e.target.value })}
              required
            />
          </label>
          <label>
            Street Address
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
          </label>
          <label>
            Apartment/Suite (Optional)
            <input
              type="text"
              value={form.apartment}
              onChange={(e) => setForm({ ...form, apartment: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              City
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              />
            </label>
            <label>
              State
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Pincode
              <input
                type="text"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                required
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </label>
          </div>
          <button className="primary-btn" type="submit">Save Changes</button>
        </form>
      ) : (
        <div className="profile-display">
          <div className="profile-item">
            <span className="profile-label">Full Name</span>
            <span className="profile-value">{currentUser.firstName} {currentUser.lastName}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Email Address</span>
            <span className="profile-value">{currentUser.email}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Phone</span>
            <span className="profile-value">{currentUser.phone}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Country/Region</span>
            <span className="profile-value">{currentUser.countryRegion}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Street Address</span>
            <span className="profile-value">{currentUser.address}</span>
          </div>
          {currentUser.apartment && (
            <div className="profile-item">
              <span className="profile-label">Apartment/Suite</span>
              <span className="profile-value">{currentUser.apartment}</span>
            </div>
          )}
          <div className="profile-item">
            <span className="profile-label">City</span>
            <span className="profile-value">{currentUser.city}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">State</span>
            <span className="profile-value">{currentUser.state}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Pincode</span>
            <span className="profile-value">{currentUser.pincode}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Account Type</span>
            <span className="profile-value">User (Shopper)</span>
          </div>
        </div>
      )}
    </div>
  );
}

function UserOrders({ bookings, products, onContactSupport, onSubmitRating, hasUserRatedBooking }) {
  if (!bookings.length) {
    return (
      <div className="account-section">
        <h2>Order History</h2>
        <div className="empty-state">
          <p>No bookings yet</p>
          <p className="text-muted">You haven't booked any sarees yet. Explore our collection and add your favorite items!</p>
          <Link className="primary-btn" to="/">Browse Collection</Link>
        </div>
      </div>
    );
  }

  // Sort bookings by date (newest first)
  const sortedBookings = [...bookings].sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));

  return (
    <div className="account-section">
      <h2>Your Bookings</h2>
      <div className="orders-summary">
        <div className="summary-item">
          <span className="summary-label">Total Orders</span>
          <span className="summary-value">{bookings.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Spent</span>
          <span className="summary-value">₹{bookings.reduce((sum, b) => sum + (b.price * (b.qty || 1)), 0).toLocaleString()}</span>
        </div>
      </div>
      <div className="orders-list">
        {sortedBookings.map((booking) => {
          const product = products.find((p) => String(p.id) === String(booking.productId));
          const statusColors = {
            'pending': '#f39c12',
            'confirmed': '#3498db',
            'shipped': '#2ecc71',
            'completed': '#27ae60',
            'cancelled': '#e74c3c'
          };
          return (
            <div key={booking.id} className="order-card">
              <div className="order-header">
                <div>
                  <h3>{booking.name}</h3>
                  <p className="order-id">Order ID: #{booking.id.toString().slice(-8)}</p>
                </div>
                <span className={`order-status ${booking.status}`} style={{ backgroundColor: statusColors[booking.status] || '#667eea' }}>
                  {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1) || 'Pending'}
                </span>
              </div>

              <div className="order-details">
                <div className="order-detail-row">
                  <div className="order-detail-item">
                    <span>Unit Price</span>
                    <strong>₹{booking.price.toLocaleString()}</strong>
                  </div>
                  <div className="order-detail-item">
                    <span>Quantity</span>
                    <strong>{booking.qty || 1}</strong>
                  </div>
                  <div className="order-detail-item">
                    <span>Booking Date</span>
                    <strong>{new Date(booking.bookedAt).toLocaleDateString('en-IN')}</strong>
                  </div>
                  <div className="order-detail-item highlight">
                    <span>Order Total</span>
                    <strong>₹{(booking.price * (booking.qty || 1)).toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {product && (
                <>
                  <div className="order-product">
                    <img
                      src={(Array.isArray(product.images) && product.images[0]) || product.image}
                      alt={product.name}
                      onError={(e) => (e.currentTarget.src = 'https://images.unsplash.com/photo-1610684537529-15f1e50c8767?w=150&h=150&fit=crop')}
                    />
                    <div className="order-product-info">
                      <h4>{product.name}</h4>
                      <p><strong>{product.fabric}</strong> • {product.category}</p>
                    </div>
                    <div className="order-actions">
                      <button type="button" className="ghost-btn" onClick={onContactSupport}>📞 Contact Support</button>
                    </div>
                  </div>

                  {booking.status === 'confirmed' && booking.shipmentStatus === 'delivered' && !hasUserRatedBooking(booking.id) && (
                    <RatingForm
                      bookingId={booking.id}
                      productId={product.id}
                      onSubmitRating={onSubmitRating}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UserSettings({ currentUser, onChangePassword }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    onChangePassword(currentUser.email, passwordForm.newPassword);
    setPasswordSuccess('Password changed successfully');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowPasswordForm(false);

    setTimeout(() => setPasswordSuccess(''), 2500);
  };

  return (
    <div className="account-section">
      <h2>Account Settings</h2>

      <div className="settings-group">
        <div className="setting-item">
          <div>
            <h3>Change Password</h3>
            <p className="text-muted">Update your password to keep your account secure</p>
          </div>
          <button
            className="ghost-btn"
            onClick={() => {
              setShowPasswordForm(!showPasswordForm);
              setPasswordError('');
              setPasswordSuccess('');
            }}
          >
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordSubmit} className="settings-form">
            <label>
              Current Password
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
              />
            </label>
            <label>
              Confirm Password
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />
            </label>

            {passwordError && <div className="error-message">{passwordError}</div>}
            {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}

            <button className="primary-btn" type="submit">Update Password</button>
          </form>
        )}
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div>
            <h3>Email Preferences</h3>
            <p className="text-muted">Manage how you receive updates and notifications</p>
          </div>
        </div>
        <label className="checkbox-setting">
          <input type="checkbox" defaultChecked />
          Receive order updates and booking confirmations
        </label>
        <label className="checkbox-setting">
          <input type="checkbox" defaultChecked />
          Receive new collection announcements
        </label>
        <label className="checkbox-setting">
          <input type="checkbox" />
          Receive promotional offers and discounts
        </label>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div>
            <h3>Privacy & Data</h3>
            <p className="text-muted">Control your data and privacy settings</p>
          </div>
        </div>
        <div className="privacy-info">
          <p>Your personal information is secure and will never be shared with third parties.</p>
          <button className="ghost-btn">Download My Data</button>
        </div>
      </div>
    </div>
  );
}

export default App;
