const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, '../locales');
let translations = { en: {}, zh: {} };

// Load translations
function loadTranslations() {
  try {
    const enPath = path.join(localesPath, 'en.json');
    const zhPath = path.join(localesPath, 'zh.json');

    if (fs.existsSync(enPath)) {
      translations.en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    }
    if (fs.existsSync(zhPath)) {
      translations.zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load translations:', err.message);
  }
}

loadTranslations();

function getPortInfo(port, lang = 'en') {
  const portStr = String(port);
  const locale = translations[lang] || translations.en;

  if (locale.ports && locale.ports[portStr]) {
    return locale.ports[portStr];
  }

  return null;
}

function getServiceTypeInfo(type, lang = 'en') {
  const locale = translations[lang] || translations.en;

  if (locale.serviceTypes && locale.serviceTypes[type]) {
    return locale.serviceTypes[type];
  }

  return null;
}

function getErrorMessage(key, lang = 'en') {
  const locale = translations[lang] || translations.en;

  if (locale.errors && locale.errors[key]) {
    return locale.errors[key];
  }

  return key;
}

module.exports = {
  getPortInfo,
  getServiceTypeInfo,
  getErrorMessage,
  loadTranslations
};
