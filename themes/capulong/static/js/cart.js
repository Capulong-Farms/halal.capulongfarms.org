// Cart Management System for Capulong Farms
const CART_KEY = 'capulong_cart';

// BMS integration — values injected via meta tags in baseof.html
const BMS_API_URL    = document.querySelector('meta[name="bms-api-url"]')?.content    || 'https://api.capulongfarms.org';
const PORTAL_API_KEY = document.querySelector('meta[name="portal-api-key"]')?.content || '';
const PORTAL_SOURCE  = document.querySelector('meta[name="portal-source"]')?.content  || 'portal-main';

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'cf-toast cf-toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('cf-toast-visible'));
  setTimeout(() => {
    toast.classList.remove('cf-toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2500);
}

function inquireAbout(productName) {
  const whatsappNumber = window.WHATSAPP_NUMBER || '966542761620';
  const msg = 'Hi! I\'d like to inquire about: ' + productName + '. What is the current price?';
  window.open('https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(msg), '_blank');
}

function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      saveCart(parsed);
      return parsed;
    }
    if (parsed.savedAt && (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000)) {
      localStorage.removeItem(CART_KEY);
      return [];
    }
    return parsed.items || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify({ items: cart, savedAt: Date.now() }));
  updateCartCount();
}

function addToCart(productName, productPrice, discount = 0) {
  const priceStr = String(productPrice);
  if (priceStr.includes('---') || priceStr.includes('___')) {
    showToast('Please contact us for pricing on this item.', 'info');
    return;
  }
  const cart = getCart();
  const existingItem = cart.find(item => item.name === productName);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ name: productName, price: productPrice, quantity: 1, discount: discount });
  }

  saveCart(cart);
  showToast(productName + ' added to cart!');
}

function addToCartWithQuantity(productName, productPrice, productId, discount = 0) {
  const priceStr = String(productPrice);
  if (priceStr.includes('---') || priceStr.includes('___')) {
    showToast('Please contact us for pricing on this item.', 'info');
    return;
  }
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
  showToast(quantity + 'x ' + productName + ' added to cart!');

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

// ── Delivery charges ───────────────────────────────────────
// Where the buyer lives decides the charge. ph-towns.js holds every province
// and town with its distance from the farm; the bands that turn a distance
// into a price live in the BMS, so the farm can change them without either
// site being rebuilt. If the BMS cannot be reached we say so rather than
// inventing a figure.
let DELIVERY_RATES = null;

async function loadDeliveryRates() {
  if (DELIVERY_RATES) return DELIVERY_RATES;
  try {
    const r = await fetch(BMS_API_URL + '/api/delivery-rates', { cache: 'no-store' });
    if (!r.ok) throw new Error('rates ' + r.status);
    DELIVERY_RATES = await r.json();
  } catch (e) {
    DELIVERY_RATES = null;
  }
  return DELIVERY_RATES;
}

function phProvinces() {
  return (window.PH_TOWNS && window.PH_TOWNS.provinces) || {};
}

function deliveryKmFor(province, town) {
  const list = phProvinces()[province] || [];
  const hit = list.find(t => t[0] === town);
  return hit ? hit[1] : null;
}

// null = beyond every band, which means courier and a charge quoted later.
function deliveryFeeForKm(km) {
  if (km == null || !DELIVERY_RATES || !DELIVERY_RATES.bands) return null;
  for (const b of DELIVERY_RATES.bands) if (km <= b.km) return b.fee;
  return null;
}

function currentDelivery() {
  const p = document.getElementById('order-province');
  const t = document.getElementById('order-town');
  if (!p || !t || !p.value || !t.value) return { province: '', town: '', km: null, fee: null, chosen: false };
  const km = deliveryKmFor(p.value, t.value);
  return { province: p.value, town: t.value, km, fee: deliveryFeeForKm(km), chosen: true };
}

function fillOrderProvinces() {
  const sel = document.getElementById('order-province');
  if (!sel || sel.dataset.filled === '1') return;
  const names = Object.keys(phProvinces());
  if (!names.length) return;
  sel.innerHTML = '<option value="">Select province…</option>' +
    names.map(p => `<option value="${p}">${p}</option>`).join('');
  sel.dataset.filled = '1';
}

function onOrderProvince() {
  const sel = document.getElementById('order-town');
  const province = document.getElementById('order-province').value;
  const list = phProvinces()[province] || [];
  sel.innerHTML = '<option value="">Select city / municipality…</option>' +
    list.map(t => `<option value="${t[0]}">${t[0]}</option>`).join('');
  sel.disabled = !province;
  onOrderTown();
}

function onOrderTown() {
  renderOrderSummary();
}

function deliveryNoteHtml() {
  const d = currentDelivery();
  if (!d.chosen) return 'Choose your province and town to see the delivery charge.';
  if (!DELIVERY_RATES) return 'We could not reach the farm to check delivery charges — we will confirm the charge with you.';
  if (d.fee === null) {
    return `<strong>${d.town}</strong> is about ${d.km} km away, beyond our delivery area. ` +
           'We will send it by courier and tell you the cost before despatch.';
  }
  if (d.fee === 0) return `<strong>${d.town}</strong> is about ${d.km} km away — delivery is free.`;
  return `<strong>${d.town}</strong> is about ${d.km} km away — delivery &#8369;${d.fee.toFixed(2)}.`;
}

function renderRateCard() {
  const box = document.getElementById('order-rate-card');
  if (!box) return;
  if (!DELIVERY_RATES || !DELIVERY_RATES.bands) { box.innerHTML = ''; return; }
  const rows = DELIVERY_RATES.bands.map((b, i) => {
    const from = i === 0 ? 0 : DELIVERY_RATES.bands[i - 1].km;
    const span = i === 0 ? `Up to ${b.km} km` : `${from}–${b.km} km`;
    return `<li><span>${span}</span><span>${b.fee === 0 ? 'Free' : '&#8369;' + b.fee.toFixed(2)}</span></li>`;
  }).join('');
  box.innerHTML = `<details><summary>Delivery charges</summary><ul class="order-rate-list">${rows}
    <li><span>Over ${DELIVERY_RATES.courierBeyondKm} km</span><span>By courier</span></li></ul>
    <small>Measured in a straight line from the farm in Candaba, Pampanga.</small></details>`;
}

function openOrderForm() {
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty!', 'info');
    return;
  }
  const modal = document.getElementById('order-form-modal');
  if (modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }
  closeCartModal();
  fillOrderProvinces();
  renderOrderSummary();
  togglePaymentFields();
  // The charge appears as soon as the rates arrive; the form is usable meanwhile.
  loadDeliveryRates().then(() => { renderRateCard(); renderOrderSummary(); });
  // Set positioning explicitly via JS — after appendChild, Chrome does not always
  // recompute position:fixed from the CSS class when display:none is in the same rule.
  modal.style.display = 'block';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.zIndex = '1000';
  modal.scrollTop = 0;
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

  const d = currentDelivery();
  const fee = d.fee || 0;
  const feeLine = document.getElementById('order-delivery-line');
  if (feeLine) {
    feeLine.innerHTML = !d.chosen ? ''
      : `<span>Delivery${d.km != null ? ' (' + d.km + ' km)' : ''}</span>` +
        `<span>${d.fee === null ? 'by courier' : d.fee === 0 ? 'Free' : '&#8369;' + d.fee.toFixed(2)}</span>`;
  }
  const note = document.getElementById('order-delivery-note');
  if (note) note.innerHTML = deliveryNoteHtml();

  // The courier charge is not known yet, so it is not in the total.
  const grand = total + fee;
  document.getElementById('order-form-total').textContent = `Total: ₱${grand.toFixed(2)}`;
  const payAmount = document.getElementById('order-pay-amount');
  if (payAmount) payAmount.textContent = `₱${grand.toFixed(2)}`;
}

// Shows the QR code and reference-number box only when "Pay now" is selected.
function togglePaymentFields() {
  const method = document.getElementById('order-payment-method');
  const box = document.getElementById('order-payment-qr');
  if (!method || !box) return;
  box.style.display = method.value === 'qr' ? 'block' : 'none';
}

async function submitOnlineOrder(event) {
  event.preventDefault();

  const name    = document.getElementById('order-name').value.trim();
  const phone   = document.getElementById('order-phone').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const delivery = currentDelivery();
  const remarks = document.getElementById('order-remarks').value.trim();
  const methodEl = document.getElementById('order-payment-method');
  const refEl    = document.getElementById('order-payment-ref');
  const paymentMethod = methodEl ? methodEl.value : 'later';
  const paymentRef    = paymentMethod === 'qr' && refEl ? refEl.value.trim() : '';

  if (!name || !phone || !address) {
    alert('Please fill in your name, phone number, and delivery address.');
    return;
  }
  if (!delivery.chosen) {
    alert('Please choose your province and city / municipality so we can work out the delivery charge.');
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
    customerAddress: [address, delivery.town, delivery.province].filter(Boolean).join(', '),
    province:        delivery.province,
    town:            delivery.town,
    remarks:         remarks,
    paymentMethod:    paymentMethod,
    paymentReference: paymentRef,
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
    togglePaymentFields();
    showOrderConfirmation(result.orderRef, phone, paymentMethod, paymentRef);

  } catch (err) {
    console.error('Order submission failed:', err);
    alert('Sorry, there was a problem submitting your order. Please try again or contact us via WhatsApp.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Place Order';
  }
}

function showOrderConfirmation(orderRef, phone, paymentMethod, paymentRef) {
  const overlay = document.createElement('div');
  overlay.className = 'order-confirm-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1099;';

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let payMsg;
  if (paymentMethod === 'qr' && paymentRef) {
    payMsg = `We received your payment reference <strong>${esc(paymentRef)}</strong>. We will verify it and contact you at <strong>${esc(phone)}</strong> to confirm delivery.`;
  } else if (paymentMethod === 'qr') {
    payMsg = `Please send your payment reference via WhatsApp, quoting <strong>${esc(orderRef)}</strong>. We will contact you at <strong>${esc(phone)}</strong> to confirm delivery.`;
  } else if (paymentMethod === 'cod') {
    payMsg = `You chose <strong>Cash on Delivery</strong>. We will contact you at <strong>${esc(phone)}</strong> to confirm the delivery schedule. Please have the exact amount ready.`;
  } else if (paymentMethod === 'cod_outside') {
    payMsg = `You chose <strong>Cash on Delivery (outside Pampanga)</strong>. We will contact you at <strong>${esc(phone)}</strong> to confirm the schedule and the extra delivery charge before we ship.`;
  } else {
    payMsg = `We will contact you at <strong>${esc(phone)}</strong> to confirm delivery and payment.`;
  }

  const dialog = document.createElement('div');
  dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:2rem;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.3);z-index:1100;text-align:center;max-width:320px;width:90%;';
  dialog.innerHTML = `
    <div style="font-size:3rem;margin-bottom:0.5rem;">&#9989;</div>
    <h3 style="color:#2e7d32;margin-bottom:0.5rem;">Order Received!</h3>
    <p>Your order reference is <strong>${orderRef}</strong>.</p>
    <p style="color:#666;font-size:0.9rem;margin:0.75rem 0 1.25rem;">${payMsg}</p>
    <button onclick="this.closest('div').remove();document.querySelector('.order-confirm-overlay').remove();"
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
    showToast('Cart cleared!', 'info');
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

