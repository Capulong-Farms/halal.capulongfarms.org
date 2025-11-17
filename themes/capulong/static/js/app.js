// Main Application JavaScript for Capulong Farms
document.addEventListener("DOMContentLoaded", function() {
  // Set WhatsApp number globally for cart.js
  window.WHATSAPP_NUMBER = document.querySelector('meta[name="whatsapp-number"]')?.content || '966542761620';
  
  updateCartCount();
  addMobileEventListeners();
  initializeTabs();
  attachFloatingContactHandlers();
  initializeDealOfTheDay();
});

// Tab functionality
function initializeTabs() {
  const tabs = document.querySelectorAll(".tab-button");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Check if this tab has an external link
      if (tab.dataset.externalLink) {
        window.open(tab.dataset.externalLink, '_blank');
        return;
      }
      
      // Regular tab functionality
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });
}

// Contact button behavior: build message from cart or fallback message
function getContactMessage() {
  const cart = getCart();
  if (!cart || cart.length === 0) {
    return 'Hi, I browsed your products and I am interested to purchase. Kindly return my message for more details?';
  }

  let message = 'I would like to order the following items:\n\n';
  let total = 0;
  cart.forEach(item => {
    const originalPrice = parseFloat(String(item.price).replace(/[^0-9.-]+/g, '')) || 0;
    const discount = item.discount || 0;
    const discountedPrice = discount === 100 ? 0 : originalPrice * (100 - discount) / 100;
    const itemTotal = discountedPrice * item.quantity;
    
    let priceDisplay = item.price;
    if (discount > 0) {
      if (discount === 100) {
        priceDisplay = `${item.price} (FREE!)`;
      } else {
        priceDisplay = `${item.price} (${discount}% off = ₱${discountedPrice.toFixed(2)})`;
      }
    }
    
    message += `• ${item.name} (${priceDisplay}) x ${item.quantity}\n`;
    total += itemTotal;
  });
  message += `\nTotal: ₱${total.toFixed(2)}\n\nPlease confirm availability and delivery.`;
  return message;
}

// Attach click handlers to floating/contact anchors (whatsapp & messenger)
function attachFloatingContactHandlers() {
  const whatsappNumber = window.WHATSAPP_NUMBER || '966542761620';
  const messengerId = '61582708015159';

  const selectors = [
    'a[href*="wa.me"]',
    'a[href*="api.whatsapp.com"]',
    'a[href*="m.me"]',
    'a[href*="facebook.com/messages"]',
    'a.floating-whatsapp',
    'a.floating-messenger',
    'a.whatsapp-float',
    'a.messenger-float',
    'a.whatsapp',
    'a.messenger',
    'a.whatsapp-contact-link',
    'a.messenger-contact-link',
    'a.contact-float'
  ].join(',');

  const anchors = document.querySelectorAll(selectors);
  anchors.forEach(a => {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      
      const cart = getCart();
      const href = (a.getAttribute('href') || '').toLowerCase();
      
      // If cart has items, open cart modal instead of sending message
      if (cart && cart.length > 0) {
        openCartModal();
        return;
      }
      
      // If cart is empty, send the fallback message
      const rawMsg = 'Hi, I browsed your products and I am interested to purchase. Kindly return my message for more details?';
      const encoded = encodeURIComponent(rawMsg);

      if (href.includes('wa.me') || href.includes('api.whatsapp') || a.classList.contains('floating-whatsapp') || a.classList.contains('whatsapp') || a.classList.contains('whatsapp-contact-link')) {
        const wa = 'https://wa.me/' + whatsappNumber + '?text=' + encoded;
        window.open(wa, '_blank');
        return;
      }

      if (href.includes('m.me') || href.includes('facebook.com/messages') || a.classList.contains('floating-messenger') || a.classList.contains('messenger-float') || a.classList.contains('messenger') || a.classList.contains('messenger-contact-link')) {
        const m = 'https://m.me/' + messengerId + '?text=' + encoded;
        window.open(m, '_blank');
        return;
      }

      // otherwise let the link behave normally
    });
  });
}

// =============================
// Deal of the Day Functionality
// =============================

// Initialize Deal of the Day
function initializeDealOfTheDay() {
  loadDealOfTheDay();
}

// Load and display the Deal of the Day product
function loadDealOfTheDay() {
  // Find deal of the day product from product cards
  const productCards = document.querySelectorAll('.product-card[data-product-name]');
  let dealProduct = null;
  
  productCards.forEach(card => {
    const productName = card.dataset.productName;
    const productPrice = card.dataset.productPrice;
    const productDiscount = card.dataset.productDiscount || 0;
    const productAvailable = !card.classList.contains('not-available');
    
    // Check if this is a deal of the day product by checking if it has deal_of_the_day: true
    // Since we can't directly access YAML data, we'll find available products with discounts for now
    // and select the first one as the deal (Sambal Belacan should be first)
    if (productAvailable && productDiscount > 0 && !dealProduct) {
      dealProduct = {
        name: productName,
        price: productPrice,
        discount: parseInt(productDiscount),
        image: card.querySelector('img')?.src,
        available: productAvailable
      };
    }
  });
  
  if (dealProduct) {
    populateDealDialog(dealProduct);
    showDealButton();
  } else {
    hideDealButton();
  }
}

// Populate the deal dialog with product information
function populateDealDialog(product) {
  const dialogContent = document.querySelector('#deal-of-the-day-dialog .deal-dialog-content');
  const productId = product.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  let discountHtml = '';
  if (product.discount > 0) {
    if (product.discount === 100) {
      discountHtml = '<div class="discount-watermark">FREE</div>';
    } else {
      discountHtml = `<div class="discount-watermark">
        <span class="discount-percentage">${product.discount}%</span>
        <span class="discount-text">discount</span>
      </div>`;
    }
  }
  
  dialogContent.innerHTML = `
    <div class="deal-product-card">
      <div class="product-image">
        <a href="javascript:void(0);" onclick="orderProduct('${product.name}', '${product.price}', ${product.discount})" style="display:block; position: relative;">
          <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='/images/placeholder.png'">
          <div class="available-icon">✔</div>
          ${discountHtml}
        </a>
      </div>
      <div class="product-details">
        <h4>${product.name}</h4>
        <p class="price">${product.price}</p>
        <div class="quantity-container">
          <label class="quantity-label">Quantity:</label>
          <div class="quantity-controls">
            <button class="qty-btn minus-btn" onclick="changeDealQuantity('${productId}', -1)">-</button>
            <input type="number" class="qty-input" id="deal-qty-${productId}" value="1" min="1" max="9999" onchange="validateDealQuantity('${productId}')" oninput="validateDealQuantityInput('${productId}')" onkeypress="return isNumberKey(event)">
            <button class="qty-btn plus-btn" onclick="changeDealQuantity('${productId}', 1)">+</button>
          </div>
        </div>
        <button class="add-to-cart-btn" onclick="addDealToCartWithQuantity('${product.name}', '${product.price}', '${productId}', ${product.discount})">
          <i class="fas fa-shopping-cart"></i> Add to Cart
        </button>
      </div>
    </div>
  `;
}

// Show Deal Button
function showDealButton() {
  const button = document.getElementById('deal-of-the-day-btn');
  if (button) {
    button.style.display = 'flex';
  }
}

// Hide Deal Button
function hideDealButton() {
  const button = document.getElementById('deal-of-the-day-btn');
  if (button) {
    button.style.display = 'none';
  }
}

// Open Deal Dialog
function openDealDialog() {
  const dialog = document.getElementById('deal-of-the-day-dialog');
  if (dialog) {
    dialog.style.display = 'block';
  }
}

// Close Deal Dialog
function closeDealDialog() {
  const dialog = document.getElementById('deal-of-the-day-dialog');
  if (dialog) {
    dialog.style.display = 'none';
  }
}

// Deal quantity management functions
function changeDealQuantity(productId, delta) {
  const input = document.getElementById('deal-qty-' + productId);
  if (input) {
    const currentValue = parseInt(input.value) || 1;
    const newValue = Math.max(1, Math.min(9999, currentValue + delta));
    input.value = newValue;
  }
}

function validateDealQuantity(productId) {
  const input = document.getElementById('deal-qty-' + productId);
  if (input) {
    let value = parseInt(input.value);
    if (isNaN(value) || value < 1) {
      input.value = 1;
    } else if (value > 9999) {
      input.value = 9999;
    }
  }
}

function validateDealQuantityInput(productId) {
  const input = document.getElementById('deal-qty-' + productId);
  if (input) {
    const value = input.value.replace(/[^0-9]/g, '');
    input.value = value;
    if (value === '' || parseInt(value) < 1) {
      input.value = 1;
    } else if (parseInt(value) > 9999) {
      input.value = 9999;
    }
  }
}

function addDealToCartWithQuantity(productName, productPrice, productId, discount = 0) {
  const quantityInput = document.getElementById('deal-qty-' + productId);
  const quantity = parseInt(quantityInput.value) || 1;
  
  const cart = getCart();
  const existingItem = cart.find(item => item.name === productName);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ name: productName, price: productPrice, quantity: quantity, discount: discount });
  }
  
  saveCart(cart);
  alert(productName + ' (x' + quantity + ') added to cart from Deal of the Day!');
  
  // Reset quantity to 1
  quantityInput.value = 1;
}