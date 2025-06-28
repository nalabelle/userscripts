// ==UserScript==
// @name        Fastmail Unsubscribe
// @namespace   nalabelle-fastmail-unsubscribe
// @description Refined unsubscribe with header hiding and button alignment
// @include     https://*.fastmail.com/*
// @include     https://fastmail.com/*
// @version     17
// @grant       GM_addStyle
// ==/UserScript==

/* istanbul ignore if */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseUnsubscribeLinks, decodeQuotedPrintable };
}

GM_addStyle(`
  #fm-unsubscribe-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 8px 0 4px 0;
    align-items: center;
  }
  #fm-unsubscribe-buttons a {
    padding: 7px 18px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 14px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s, color 0.2s;
    text-decoration: none !important;
    display: inline-flex;
    align-items: center;
    box-shadow: none;
  }
  #fm-http-unsubscribe {
    background-color: #28a745;
    color: #fff !important;
  }
  #fm-http-unsubscribe:hover {
    background-color: #218838;
  }
  #fm-mailto-unsubscribe {
    background-color: #dc3545;
    color: #fff !important;
  }
  #fm-mailto-unsubscribe:hover {
    background-color: #c82333;
  }
  @media (prefers-color-scheme: dark) {
    #fm-http-unsubscribe {
      background-color: #198754;
    }
    #fm-http-unsubscribe:hover {
      background-color: #157347;
    }
    #fm-mailto-unsubscribe {
      background-color: #bb2d3b;
    }
    #fm-mailto-unsubscribe:hover {
      background-color: #a02834;
    }
  }
`);

function decodeQuotedPrintable(str) {
    str = str.replace(/\s/g, '');

    // Handle both Q and B encodings
    const encodedPattern = /=\?([^?]+)\?([QB])\?([^?]*)\?=/gi;

    return str.replace(encodedPattern, (_match, _charset, encoding, encodedText) => {
        if (encoding.toUpperCase() === 'Q') {
            // Q-encoding (Quoted-Printable)
            return encodedText
                .replace(/_/g, ' ')  // Q encoding uses _ for spaces
                .replace(/=([0-9A-F]{2})/gi, (_hexMatch, hex) => {
                    return String.fromCharCode(parseInt(hex, 16));
                });
        } else if (encoding.toUpperCase() === 'B') {
            // B-encoding (Base64)
            try {
                return atob(encodedText);
            } catch (e) {
                return encodedText; // Return original if decode fails
            }
        }
        return encodedText;
    }).trim();
}


function parseUnsubscribeLinks() {
  const detailsSection = document.querySelector('.v-Message-details');
  if (!detailsSection) return null;

  const titles = detailsSection.querySelectorAll('.v-Message-detailsTitle');
  let unsubscribeValue = null, unsubscribeTitle = null;
  titles.forEach(title => {
    if (title.textContent.trim() === 'List-Unsubscribe:') {
      unsubscribeTitle = title;
      unsubscribeValue = title.nextElementSibling;
    }
  });
  if (!unsubscribeValue) return null;
  let headerText = unsubscribeValue.textContent?.trim() || '';
  if (!headerText) return { links: [] };

  // Check if header is MIME encoded
  if (headerText.startsWith('=?')) {
    headerText = decodeQuotedPrintable(headerText);
  }
  const links = [];
  // Clean up whitespace and line breaks in the header text
  headerText = headerText.replace(/\s+/g, ' ').trim();

  // First try to extract URLs from angle brackets
  const angleBracketRegex = /<([^>\s]+)>/g;
  let match;
  while ((match = angleBracketRegex.exec(headerText)) !== null) {
    const url = match[1].trim();
    if (url.startsWith('http')) {
      links.push({ type: 'http', url });
    } else if (url.startsWith('mailto')) {
      links.push({ type: 'email', url });
    }
  }

  // If no bracketed URLs found, try to extract bare URLs
  if (links.length === 0) {
    // Enhanced URL regex to handle complex paths and parameters
    const urlRegex = /(https?:\/\/[^\s,<>"']+(?:\([^\s,<>"']+\)|[^\s,<>"'()])*|mailto:[^\s,<>"']+)/gi;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(headerText)) !== null) {
      const url = urlMatch[0].trim();
      if (url.startsWith('http')) {
        links.push({ type: 'http', url });
      } else if (url.startsWith('mailto')) {
        links.push({ type: 'email', url });
      }
    }
  }
  return { links, unsubscribeTitle, unsubscribeValue };
}

function createUnsubscribeButtons(links) {
  // Early return if no valid links
  if (!Array.isArray(links) || links.length === 0) return false;

  // Remove existing buttons if any
  document.getElementById('fm-unsubscribe-buttons')?.remove();

  // Create button container with document fragment for better performance
  const fragment = document.createDocumentFragment();
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'fm-unsubscribe-buttons';
  fragment.appendChild(buttonContainer);

  // Create buttons based on link types
  const httpLink = links.find(link => link.type === 'http');
  const mailtoLink = links.find(link => link.type === 'email');

  if (httpLink) {
    const httpButton = document.createElement('a');
    httpButton.id = 'fm-http-unsubscribe';
    httpButton.innerHTML = '🌐 Web Unsubscribe';
    httpButton.href = httpLink.url;
    httpButton.target = '_blank';
    buttonContainer.appendChild(httpButton);
  }

  if (mailtoLink) {
    const mailtoButton = document.createElement('a');
    mailtoButton.id = 'fm-mailto-unsubscribe';
    mailtoButton.innerHTML = '📧 Email Unsubscribe';
    mailtoButton.href = mailtoLink.url;
    buttonContainer.appendChild(mailtoButton);
  }

  // Insert buttons in the most efficient location
  const header = document.querySelector(SELECTORS.header);
  const targetElement = header || document.querySelector(SELECTORS.body);
  if (!targetElement) return false;

  if (header) {
    targetElement.appendChild(fragment);
  } else {
    targetElement.insertBefore(fragment, targetElement.firstChild);
  }
  return true;
}

// Cache selectors
const SELECTORS = {
  details: '.v-Message-details',
  header: '.v-Message-header',
  body: '.v-Message-body',
  mailboxItem: '.v-MailboxItem'
};

// Debug logging
function log(message) {
  console.debug(`Fastmail Unsubscribe: ${message}`);
}

// State tracking to prevent duplicate processing
let isProcessing = false;
let buttonsCreated = false;

// Observer implementation
const observer = new MutationObserver(() => {
  // Prevent concurrent processing
  if (isProcessing || buttonsCreated) return;

  try {
    isProcessing = true;
    const detailsSection = document.querySelector(SELECTORS.details);
    if (!detailsSection) return;

    log('Details section found');
    const existingButtons = document.getElementById('fm-unsubscribe-buttons');
    if (existingButtons) {
      log('Buttons already exist');
      buttonsCreated = true;
      observer.disconnect();
      return;
    }

    const result = parseUnsubscribeLinks();
    if (!result?.links?.length) {
      log('No unsubscribe links found');
      return;
    }

    log(`Found ${result.links.length} unsubscribe links`);
    const created = createUnsubscribeButtons(result.links);
    if (created) {
      log('Unsubscribe buttons created');
      // Hide List-Unsubscribe header and value
      if (result.unsubscribeTitle) result.unsubscribeTitle.style.display = "none";
      if (result.unsubscribeValue) result.unsubscribeValue.style.display = "none";
      buttonsCreated = true;
      observer.disconnect();
    }
  } catch (error) {
    log(`Error: ${error.message}`);
  } finally {
    isProcessing = false;
  }
});

function initObserver() {
  log('Initializing observer');
  // Reset state
  buttonsCreated = false;
  isProcessing = false;

  try {
    observer.disconnect();
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } catch (error) {
    log(`Observer init error: ${error.message}`);
  }
}

// Initialize immediately and on navigation
initObserver();

// Re-initialize on mailbox item clicks
document.addEventListener('click', (event) => {
  if (event.target.closest(SELECTORS.mailboxItem)) {
    log('Mail item clicked, reinitializing observer');
    initObserver();
  }
});
