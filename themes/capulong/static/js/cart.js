// Cart Management System for Capulong Farms
const CART_KEY = 'capulong_cart';

// BMS integration — values injected via meta tags in baseof.html
const BMS_API_URL    = document.querySelector('meta[name="bms-api-url"]')?.content    || 'https://api.capulongfarms.org';
const PORTAL_API_KEY = document.querySelector('meta[name="portal-api-key"]')?.content || '';
const PORTAL_SOURCE  = document.querySelector('meta[name="portal-source"]')?.content  || 'portal-main';

function getCart() {
  const cart = localStorage.getItem(CART_KEY);
  return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(productName, productPrice, discount = 0) {
  const cart = getCart();
  const existingItem = cart.find(item => item.name === productName);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ name: productName, price: productPrice, quantity: 1, discount: discount });
  }
  
  saveCart(cart);
  alert(productName + ' added to cart!');
}

function addToCartWithQuantity(productName, productPrice, productId, discount = 0) {
  const quantityInput = document.getElementById('qty-' + productId);
  const quantity = parseInt(quantityInput.value) || 1;
  
  const cart = getCart();
  const existingItem = cart.find(item => item.name === productName);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ name: productName, price: productPrice, quantity: quantity, discount: discount });
  }
  
  saveCart(cart);
  alert(quantity + 'x ' + productName + ' added to cart!');
  
  // Reset quantity to 1 after adding
  quantityInput.value = 1;
}

function changeQuantity(productId, change) {
  const quantityInput = document.getElementById('qty-' + productId);
  let currentValue = parseInt(quantityInput.value) || 1;
  let newValue = currentValue + change;
  
  // Ensure value stays within bounds
  if (newValue < 1) newValue = 1;
  if (newValue > 9999) newValue = 9999;
  
  quantityInput.value = newValue;
}

function validateQuantity(productId) {
  const quantityInput = document.getElementById('qty-' + productId);
  let value = quantityInput.value.trim();
  
  // If empty or invalid, set to 1
  if (value === '' || isNaN(value) || value <= 0) {
    quantityInput.value = 1;
    return;
  }
  
  let numValue = parseInt(value);
  
  // Ensure value stays within bounds
  if (numValue < 1) numValue = 1;
  if (numValue > 9999) numValue = 9999;
  
  quantityInput.value = numValue;
}

function validateQuantityInput(productId) {
  const quantityInput = document.getElementById('qty-' + productId);
  let value = quantityInput.value;
  
  // Remove any non-numeric characters
  value = value.replace(/[^0-9]/g, '');
  
  // If empty after cleaning, don't set to 1 immediately (let user continue typing)
  if (value === '') {
    quantityInput.value = '';
    return;
  }
  
  // Convert to number and validate bounds
  let numValue = parseInt(value);
  if (numValue < 1) numValue = 1;
  if (numValue > 9999) numValue = 9999;
  
  quantityInput.value = numValue;
}

function isNumberKey(evt) {
  var charCode = (evt.which) ? evt.which : evt.keyCode;
  // Allow: backspace, delete, tab, escape, enter
  if (charCode == 46 || charCode == 8 || charCode == 9 || charCode == 27 || charCode == 13) {
    return true;
  }
  // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if (charCode == 65 && evt.ctrlKey === true || 
      charCode == 67 && evt.ctrlKey === true || 
      charCode == 86 && evt.ctrlKey === true ||
      charCode == 88 && evt.ctrlKey === true) {
    return true;
  }
  // Ensure that it is a number and stop the keypress
  if (charCode < 48 || charCode > 57) {
    return false;
  }
  return true;
}

function updateCartCount() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartBadge = document.getElementById('cart-count');
  if (cartBadge) {
    cartBadge.textContent = totalItems;
    cartBadge.style.display = totalItems > 0 ? 'inline' : 'none';
  }
}

function orderProduct(productName, productPrice, discount = 0) {
  addToCart(productName, productPrice, discount);
}

// ── Online Order Flow ────────────────────────────────────────

function openOrderForm() {
  const cart = getCart();
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }
  // Move modal to document.body so position:fixed anchors to the true viewport
  // regardless of any scrollable parent containers in the Hugo template
  const modal = document.getElementById('order-form-modal');
  if (modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }
  closeCartModal();
  renderOrderSummary();
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeOrderForm() {
  document.getElementById('order-form-modal').style.display = 'none';
  document.body.style.overflow = 'auto';
  openCartModal();
}

function renderOrderSummary() {
  const cart = getCart();
  let total = 0;
  let html = '';
  cart.forEach(item => {
    const originalPrice = parseFloat(String(item.price).replace(/[^0-9.-]+/g, '')) || 0;
    const discount = item.discount || 0;
    const discountedPrice = discount === 100 ? 0 : originalPrice * (100 - discount) / 100;
    const itemTotal = discountedPrice * item.quantity;
    total += itemTotal;
    html += `<div class="order-summary-item">
      <span class="order-summary-name">${item.name} &times; ${item.quantity}</span>
      <span class="order-summary-price">&#8369;${itemTotal.toFixed(2)}</span>
    </div>`;
  });
  document.getElementById('order-summary-items').innerHTML = html;
  document.getElementById('order-form-total').textContent = `Total: ₱${total.toFixed(2)}`;
}

async function submitOnlineOrder(event) {
  event.preventDefault();

  const name    = document.getElementById('order-name').value.trim();
  const phone   = document.getElementById('order-phone').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const remarks = document.getElementById('order-remarks').value.trim();

  if (!name || !phone || !address) {
    alert('Please fill in your name, phone number, and delivery address.');
    return;
  }

  const btn = document.getElementById('submit-order-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

  const cart = getCart();
  const orderData = {
    source:          PORTAL_SOURCE,
    customerName:    name,
    customerPhone:   phone,
    customerAddress: address,
    remarks:         remarks,
    items: cart.map(item => ({
      name:     item.name,
      price:    parseFloat(String(item.price).replace(/[^0-9.-]+/g, '')) || 0,
      quantity: item.quantity,
      discount: item.discount || 0,
    })),
  };

  try {
    const response = await fetch(BMS_API_URL + '/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Key': PORTAL_API_KEY,
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) throw new Error('Server error ' + response.status);

    const result = await response.json();

    // Success — clear cart, close form, show confirmation
    localStorage.removeItem(CART_KEY);
    updateCartCount();
    document.getElementById('order-form-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    // Reset form for next use
    document.getElementById('online-order-form').reset();
    showOrderConfirmation(result.orderRef, phone);

  } catch (err) {
    console.error('Order submission failed:', err);
    alert('Sorry, there was a problem submitting your order. Please try again or contact us via WhatsApp.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Place Order';
  }
}

function showOrderConfirmation(orderRef, phone) {
  const overlay = document.createElement('div');
  overlay.className = 'order-confirm-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1099;';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:2rem;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.3);z-index:1100;text-align:center;max-width:320px;width:90%;';
  dialog.innerHTML = `
    <div style="font-size:3rem;margin-bottom:0.5rem;">&#9989;</div>
    <h3 style="color:#2e7d32;margin-bottom:0.5rem;">Order Received!</h3>
    <p>Your order reference is <strong>${orderRef}</strong>.</p>
    <p style="color:#666;font-size:0.9rem;margin:0.75rem 0 1.25rem;">We will contact you at <strong>${phone}</strong> to confirm delivery and payment.</p>
    <button onclick="this.closest('div').remove();document.querySelector('.order-confirm-overlay').remove();document.body.style.overflow='auto';"
      style="padding:0.6rem 1.5rem;background:#2e7d32;color:white;border:none;border-radius:6px;font-size:1rem;cursor:pointer;font-weight:bold;">
      OK
    </button>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
}

function openCartModal() {
  const modal = document.getElementById('cart-modal');
  renderCartItems();
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeCartModal() {
  const modal = document.getElementById('cart-modal');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore scrolling
}

function renderCartItems() {
  const cart = getCart();
  const cartItemsContainer = document.getElementById('cart-items');
  const cartEmptyContainer = document.getElementById('cart-empty');
  const cartTotalElement = document.getElementById('cart-total-amount');
  
  if (cart.length === 0) {
    cartItemsContainer.style.display = 'none';
    cartEmptyContainer.style.display = 'block';
    cartTotalElement.textContent = 'Total: ₱0.00';
    return;
  }
  
  cartItemsContainer.style.display = 'block';
  cartEmptyContainer.style.display = 'none';
  
  let total = 0;
  let cartHTML = '';
  
  cart.forEach((item, index) => {
    const originalPrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ''));
    const discount = item.discount || 0;
    const discountedPrice = discount === 100 ? 0 : originalPrice * (100 - discount) / 100;
    const itemTotal = discountedPrice * item.quantity;
    total += itemTotal;
    
    let priceDisplay = item.price;
    if (discount > 0) {
      if (discount === 100) {
        priceDisplay = `${item.price} (FREE!)`;
      } else {
        priceDisplay = `${item.price} (${discount}% off = ₱${discountedPrice.toFixed(2)})`;
      }
    }
    
    cartHTML += `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p class="cart-item-price">${priceDisplay} each</p>
        </div>
        <div class="cart-item-controls">
          <div class="cart-quantity-controls">
            <button class="cart-qty-btn" onclick="updateCartQuantity(${index}, ${item.quantity - 1})">-</button>
            <span class="cart-qty-display">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="updateCartQuantity(${index}, ${item.quantity + 1})">+</button>
          </div>
          <div class="cart-item-total">₱${itemTotal.toFixed(2)}</div>
          <button class="cart-remove-btn" onclick="removeFromCart(${index})" title="Remove item">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  cartItemsContainer.innerHTML = cartHTML;
  cartTotalElement.textContent = `Total: ₱${total.toFixed(2)}`;
}

function updateCartQuantity(index, newQuantity) {
  const cart = getCart();
  
  if (newQuantity <= 0) {
    cart.splice(index, 1);
  } else if (newQuantity > 9999) {
    cart[index].quantity = 9999;
  } else {
    cart[index].quantity = newQuantity;
  }
  
  saveCart(cart);
  renderCartItems();
}

function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCartItems();
}

function clearCart() {
  if (confirm('Are you sure you want to clear your cart?')) {
    localStorage.removeItem(CART_KEY);
    updateCartCount();
    renderCartItems();
    alert('Cart cleared!');
  }
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
  const modal = document.getElementById('cart-modal');
  if (event.target === modal) {
    closeCartModal();
  }
});

// Add mobile-friendly event listeners
function addMobileEventListeners() {
  const cartButton = document.getElementById('cart-button');
  if (cartButton) {
    // Remove any existing onclick
    cartButton.removeAttribute('onclick');
    
    // Add both touch and click events for better mobile compatibility
    cartButton.addEventListener('touchstart', function(e) {
      e.preventDefault();
      openCartModal();
    }, { passive: false });
    
    cartButton.addEventListener('click', function(e) {
      e.preventDefault();
      openCartModal();
    });
  }
}

