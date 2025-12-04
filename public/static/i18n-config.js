/**
 * i18n Configuration for Training Platform
 * Handles multi-language support with i18next
 */

// Supported languages configuration
const SUPPORTED_LANGUAGES = {
  'en-US': { name: 'English (US)', flag: '🇺🇸', nativeName: 'English' },
  'en-GB': { name: 'English (UK)', flag: '🇬🇧', nativeName: 'English' },
  'ja': { name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  'pt-BR': { name: 'Portuguese (Brazil)', flag: '🇧🇷', nativeName: 'Português' },
  'id': { name: 'Bahasa Indonesia', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
  'ms': { name: 'Malay', flag: '🇲🇾', nativeName: 'Bahasa Melayu' }
};

const DEFAULT_LANGUAGE = 'en-US';
const FALLBACK_LANGUAGE = 'en-US';

/**
 * Initialize i18next with configuration
 */
async function initI18n(namespaces = ['common']) {
  const savedLanguage = getSavedLanguage();
  const browserLanguage = detectBrowserLanguage();
  const initialLanguage = savedLanguage || browserLanguage || DEFAULT_LANGUAGE;

  // Ensure namespaces is an array
  if (typeof namespaces === 'string') {
    namespaces = [namespaces];
  }

  await i18next
    .use(i18nextHttpBackend)
    .init({
      lng: initialLanguage,
      fallbackLng: FALLBACK_LANGUAGE,
      debug: false,
      ns: namespaces,
      defaultNS: namespaces[0],
      backend: {
        loadPath: '/static/locales/{{lng}}/{{ns}}.json'
      },
      interpolation: {
        escapeValue: false // HTML is already escaped
      }
    });

  // Update HTML lang attribute
  document.documentElement.lang = initialLanguage;
  
  return i18next;
}

/**
 * Get saved language from localStorage or user object
 */
function getSavedLanguage() {
  // Check localStorage first
  const localStorageLang = localStorage.getItem('preferredLanguage');
  if (localStorageLang && SUPPORTED_LANGUAGES[localStorageLang]) {
    return localStorageLang;
  }

  // Check user object (if logged in)
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.preferred_language && SUPPORTED_LANGUAGES[user.preferred_language]) {
      return user.preferred_language;
    }
  } catch (e) {
    console.error('Error parsing user data:', e);
  }

  return null;
}

/**
 * Detect browser language and map to supported language
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  
  // Try exact match first
  if (SUPPORTED_LANGUAGES[browserLang]) {
    return browserLang;
  }

  // Try language without region (e.g., 'en' from 'en-AU')
  const langCode = browserLang.split('-')[0];
  
  // Map common variants
  const languageMap = {
    'en': 'en-US',
    'pt': 'pt-BR',
    'ja': 'ja',
    'id': 'id',
    'ms': 'ms'
  };

  return languageMap[langCode] || DEFAULT_LANGUAGE;
}

/**
 * Change language and persist preference
 */
async function changeLanguage(languageCode) {
  if (!SUPPORTED_LANGUAGES[languageCode]) {
    console.error('Unsupported language:', languageCode);
    return;
  }

  // Change i18next language
  await i18next.changeLanguage(languageCode);

  // Save to localStorage
  localStorage.setItem('preferredLanguage', languageCode);

  // Update HTML lang attribute
  document.documentElement.lang = languageCode;

  // Save to database if user is logged in
  try {
    const token = localStorage.getItem('token');
    if (token) {
      await axios.put('/api/user/preferences', {
        preferred_language: languageCode
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Update user object in localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.preferred_language = languageCode;
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch (error) {
    console.error('Error saving language preference:', error);
  }

  // Reload translations on current page
  translatePage();
}

/**
 * Translate all elements with data-i18n attributes
 */
function translatePage() {
  // Translate text content
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = i18next.t(key);
    
    if (translation !== key) {
      element.textContent = translation;
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    const translation = i18next.t(key);
    
    if (translation !== key) {
      element.placeholder = translation;
    }
  });

  // Translate titles (tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    const translation = i18next.t(key);
    
    if (translation !== key) {
      element.title = translation;
    }
  });

  // Translate aria-labels
  document.querySelectorAll('[data-i18n-aria]').forEach(element => {
    const key = element.getAttribute('data-i18n-aria');
    const translation = i18next.t(key);
    
    if (translation !== key) {
      element.setAttribute('aria-label', translation);
    }
  });
}

/**
 * Get list of supported languages for UI
 */
function getSupportedLanguages() {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
    code,
    ...info
  }));
}

/**
 * Get current language
 */
function getCurrentLanguage() {
  return i18next.language || DEFAULT_LANGUAGE;
}

/**
 * Format date according to locale
 */
function formatDate(date, format = 'long') {
  const locale = getCurrentLanguage();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formats = {
    'short': { year: 'numeric', month: 'numeric', day: 'numeric' },
    'medium': { year: 'numeric', month: 'short', day: 'numeric' },
    'long': { year: 'numeric', month: 'long', day: 'numeric' },
    'full': { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  };

  return new Intl.DateTimeFormat(locale, formats[format]).format(dateObj);
}

/**
 * Format time in 24-hour format (as per requirements)
 */
function formatTime(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

/**
 * Format datetime
 */
function formatDateTime(date) {
  return `${formatDate(date, 'medium')} ${formatTime(date)}`;
}

/**
 * Format number with locale-specific formatting (always 1,234.56 format per requirements)
 */
function formatNumber(number, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(number);
}

/**
 * Format currency
 */
function formatCurrency(amount, currency = 'USD') {
  const locale = getCurrentLanguage();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Helper function to create language selector HTML
 */
function createLanguageSelector(containerId, currentLanguage = null) {
  const languages = getSupportedLanguages();
  const current = currentLanguage || getCurrentLanguage();
  
  const currentLang = SUPPORTED_LANGUAGES[current];
  
  const html = `
    <div class="relative">
      <button onclick="toggleLanguageDropdown()" 
              class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        <span class="text-xl">${currentLang.flag}</span>
        <span class="font-medium">${currentLang.nativeName}</span>
        <i class="fas fa-chevron-down text-sm"></i>
      </button>
      
      <div id="language-dropdown" 
           class="hidden absolute top-full mt-2 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px]">
        ${languages.map(lang => `
          <button onclick="selectLanguage('${lang.code}')" 
                  class="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center gap-3 ${lang.code === current ? 'bg-blue-50' : ''}">
            <span class="text-xl">${lang.flag}</span>
            <span class="flex-1">${lang.nativeName}</span>
            ${lang.code === current ? '<i class="fas fa-check text-blue-600"></i>' : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  document.getElementById(containerId).innerHTML = html;
}

/**
 * Toggle language dropdown
 */
function toggleLanguageDropdown() {
  const dropdown = document.getElementById('language-dropdown');
  dropdown.classList.toggle('hidden');
}

/**
 * Select language from dropdown
 */
async function selectLanguage(languageCode) {
  await changeLanguage(languageCode);
  
  // Close dropdown
  const dropdown = document.getElementById('language-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
  
  // Update selector button
  const currentLang = SUPPORTED_LANGUAGES[languageCode];
  const button = document.querySelector('[onclick="toggleLanguageDropdown()"]');
  if (button) {
    button.querySelector('span:first-child').textContent = currentLang.flag;
    button.querySelector('span:nth-child(2)').textContent = currentLang.nativeName;
  }
  
  // Refresh page to apply translations
  window.location.reload();
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('language-dropdown');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    const button = event.target.closest('[onclick="toggleLanguageDropdown()"]');
    if (!button && !dropdown.contains(event.target)) {
      dropdown.classList.add('hidden');
    }
  }
});
