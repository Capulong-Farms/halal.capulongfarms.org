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

// What the farm can still sell, by product name. Fetched when the order form
// opens rather than cached for the visit: stock is the one figure that must
// not be stale, and two shoppers can be in the cart at the same moment.
// null for a product means it is not stock-tracked - a course or a service.
let STOCK = null;

// The same reply carries the harvest days and the farm's cut-off, because the
// earliest date depends on both and neither is worth a second request.
let FRESH = null;        // { cutoffTime, leadDays, dispatchDays, today, now }
let HARVEST = null;      // product name -> weekdays it is picked

async function loadStock() {
  try {
    const r = await fetch(BMS_API_URL + '/api/stock', { cache: 'no-store' });
    if (!r.ok) throw new Error('stock ' + r.status);
    const d = await r.json();
    STOCK = d.stock || {};
    FRESH = d.fulfilment || null;
    HARVEST = d.harvest || {};
  } catch (e) {
    STOCK = null;        // unreachable: let the order through, the server checks again
    FRESH = null;
    HARVEST = null;
  }
  return STOCK;
}

// ── When can it actually arrive? ──────────────────
// This mirrors earliestDate() in the BMS server, deliberately: the date shown
// here has to be the date the server accepts, or the shop promises a day the
// farm then changes. If you change one, change the other.
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayAdd(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayOfWeek(ymd) { return new Date(ymd + 'T00:00:00Z').getUTCDay(); }

function nextDayIn(from, days) {
  if (!days || !days.length) return from;
  for (let i = 0; i < 14; i++) {
    const d = dayAdd(from, i);
    if (days.includes(dayOfWeek(d))) return d;
  }
  return from;
}

// null when the farm could not be reached - the form then says the date will
// be confirmed, the same way it does for a delivery charge it cannot price.
function earliestFulfilment() {
  if (!FRESH || !FRESH.today) return null;
  const parts = String(FRESH.cutoffTime || '15:00').split(':');
  const nowParts = String(FRESH.now || '00:00').split(':');
  const past = Number(nowParts[0]) * 60 + Number(nowParts[1])
               >= Number(parts[0]) * 60 + Number(parts[1]);
  const base = dayAdd(FRESH.today, (Number(FRESH.leadDays) || 0) + (past ? 1 : 0));
  // Every window is measured from the same starting point and the latest one
  // wins - the order waits until all of it has been picked. Advancing a
  // running date made the waits compound instead.
  let want = base;
  getCart().forEach(item => {
    const h = (HARVEST || {})[item.name];
    if (!Array.isArray(h) || !h.length) return;
    const d = nextDayIn(base, h.map(Number));
    if (d > want) want = d;
  });
  return nextDayIn(want, (FRESH.dispatchDays || []).map(Number));
}

function prettyDate(ymd) {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00Z');
  return DOW_SHORT[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' +
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
}

// The cart items that are only picked on certain days, so the wait has a
// reason attached to it rather than looking like a delay.
function harvestNotes() {
  return getCart().reduce((out, item) => {
    const h = (HARVEST || {})[item.name];
    if (Array.isArray(h) && h.length) {
      const names = h.map(Number).sort((a, b) => a - b).map(i => DOW_SHORT[i]);
      out.push(item.name + ' is picked ' +
        (names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0]));
    }
    return out;
  }, []);
}

// Fills the date box once the farm's rules have arrived. Called after every
// load, because a changed cart can change the earliest day.
function renderFulfilment() {
  const input = document.getElementById('order-date');
  const note = document.getElementById('order-date-note');
  if (!input || !note) return;
  const first = earliestFulfilment();
  if (!first) {
    input.value = '';
    input.removeAttribute('min');
    note.textContent = 'We will confirm the date with you when we get in touch.';
    return;
  }
  input.min = first;
  if (!input.value || input.value < first) input.value = first;
  const notes = harvestNotes();
  note.innerHTML = 'Earliest we can have this ready: <strong>' + prettyDate(first) + '</strong>.' +
    (FRESH.cutoffTime ? ' Orders after ' + FRESH.cutoffTime + ' are prepared the next day.' : '') +
    (notes.length ? '<br>' + notes.join('. ') + '.' : '') +
    '<br>Choose a later day if it suits you better.';
}

// Returns the lines that cannot be filled, with what is left of each.
function cartStockProblems() {
  if (!STOCK) return [];
  return getCart().reduce((bad, item) => {
    const left = STOCK[item.name];
    if (left == null) return bad;                  // not tracked, or unknown to the farm
    if (item.quantity > left) bad.push({ name: item.name, wanted: item.quantity, left: Math.max(0, left) });
    return bad;
  }, []);
}

function stockProblemMessage(problems) {
  return 'Sorry, these are no longer available in that quantity:\n\n' +
    problems.map(p => `\u2022 ${p.name} \u2014 you asked for ${p.wanted}, ` +
      (p.left ? `only ${p.left} left` : 'none left')).join('\n') +
    '\n\nPlease adjust your cart and try again.';
}

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

// A town the farm priced by hand ignores the bands, so the figure shown here
// is the one that will be charged.
function deliveryOverrideFor(province, town) {
  const list = (DELIVERY_RATES && DELIVERY_RATES.overrides) || [];
  const hit = list.find(o => o.town === town && (!o.province || o.province === province));
  return hit ? hit.fee : null;
}

// null = beyond every band, which means courier and a charge quoted later.
function deliveryFeeForKm(km) {
  if (km == null || !DELIVERY_RATES || !DELIVERY_RATES.bands) return null;
  for (const b of DELIVERY_RATES.bands) if (km <= b.km) return b.fee;
  return null;
}

// Unticked is the ordinary case: it is being delivered, and the distance to
// the chosen town decides what that costs.
function deliveryMethod() {
  const el = document.getElementById('order-pickup');
  return el && el.checked ? 'pickup' : 'deliver';
}

// Three outcomes, and only the first is a choice: collecting it yourself is
// free, a town inside the last band is charged from the rate card, and
// anything further has to go by courier at a price nobody knows until the
// courier is booked and the parcel is weighed.
function currentDelivery() {
  if (deliveryMethod() === 'pickup') {
    return { method: 'pickup', province: '', town: '', km: 0, fee: 0, chosen: true, courier: false };
  }
  const p = document.getElementById('order-province');
  const t = document.getElementById('order-town');
  if (!p || !t || !p.value || !t.value) {
    return { method: 'deliver', province: '', town: '', km: null, fee: null, chosen: false, courier: false };
  }
  const km = deliveryKmFor(p.value, t.value);
  const fixed = deliveryOverrideFor(p.value, t.value);
  const beyond = fixed == null && DELIVERY_RATES && km != null && km > DELIVERY_RATES.courierBeyondKm;
  return { method: 'deliver', province: p.value, town: t.value, km,
           fee: fixed != null ? fixed : deliveryFeeForKm(km), chosen: true, courier: !!beyond };
}

function onDeliveryMethod() {
  const pickup = deliveryMethod() === 'pickup';
  const block = document.getElementById('order-address-block');
  const note = document.getElementById('order-pickup-note');
  // Greyed rather than hidden: the customer can see what is being skipped,
  // and nothing jumps around when the box is ticked.
  if (block) block.classList.toggle('is-muted', pickup);
  if (note) note.style.display = pickup ? 'block' : 'none';
  // Disabled as well as unrequired - a required field the browser cannot
  // focus blocks the submit with a message pointing at nothing.
  ['order-province', 'order-town', 'order-address'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.required = !pickup;
    el.disabled = pickup || (id === 'order-town' && !document.getElementById('order-province').value);
  });
  renderOrderSummary();
}

// Cash on delivery only makes sense for the distance actually involved, and
// not at all when the customer is collecting.
function updatePaymentOptions() {
  const sel = document.getElementById('order-payment-method');
  if (!sel) return;
  const d = currentDelivery();
  const pickup = d.method === 'pickup';
  const show = { cod: !pickup && d.chosen && !d.courier, cod_outside: !pickup && d.chosen && d.courier };
  [...sel.options].forEach(opt => {
    if (opt.value === 'qr') return;        // paying now works either way
    if (opt.value === 'cod') {
      opt.textContent = pickup
        ? 'Pay in cash when you collect'
        : 'Cash on Delivery (within ' + ((DELIVERY_RATES && DELIVERY_RATES.courierBeyondKm) || 100) + ' km) \u2014 delivery charge applies';
      opt.hidden = !(pickup || show.cod);
      opt.disabled = opt.hidden;
      return;
    }
    if (opt.value === 'cod_outside') {
      opt.hidden = !show.cod_outside;
      opt.disabled = opt.hidden;
    }
  });
  // If the choice on screen no longer applies, fall back to paying now.
  const cur = sel.options[sel.selectedIndex];
  if (cur && cur.disabled) { sel.value = 'qr'; togglePaymentFields(); }
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

// The customer only ever chooses one thing: whether they are collecting.
// Which of the other two applies is decided by how far their town is, so both
// are shown greyed, with the live one picked out once a town is chosen.
function renderDeliveryCases() {
  const box = document.getElementById('order-cases');
  if (!box) return;
  const d = currentDelivery();
  const limit = (DELIVERY_RATES && DELIVERY_RATES.courierBeyondKm) || 100;
  const rows = [
    { on: d.method === 'pickup',
      text: 'Pick up at the farm \u2014 no delivery charge' },
    { on: d.method === 'deliver' && d.chosen && !d.courier,
      text: `Delivery within ${limit} km \u2014 charged by distance, see the rates below` },
    { on: d.method === 'deliver' && d.chosen && d.courier,
      text: `Delivery over ${limit} km \u2014 by courier; the charge depends on weight and ` +
            'distance and is collected before despatch' },
  ];
  box.innerHTML = rows.map(r =>
    `<li class="${r.on ? 'is-active' : ''}">${r.on ? '\u25cf' : '\u25cb'} ${r.text}</li>`).join('');
}

function deliveryNoteHtml() {
  const d = currentDelivery();
  if (d.method === 'pickup') return 'No delivery charge — you are collecting at the farm.';
  if (!d.chosen) return 'Choose your province and town to see the delivery charge.';
  if (!DELIVERY_RATES) return 'We could not reach the farm to check delivery charges — we will confirm the charge with you.';
  if (d.fee === null) {
    return `<strong>${d.town}</strong> is about ${d.km} km away, past our ` +
           `${DELIVERY_RATES.courierBeyondKm} km delivery limit. It will go by courier, ` +
           'and the courier charge depends on the weight and the distance — we will tell you the ' +
           'amount and collect it before despatch.';
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

// form.reset() restores field values, but a button's disabled state and its
// label are not form values: after a successful order they survived, and every
// later order form opened showing a dead "Submitting..." button. Putting the
// button right whenever the form opens covers that, a submit interrupted by a
// closed tab, and anything else that leaves it mid-flight.
function resetSubmitButton() {
  const btn = document.getElementById('submit-order-btn');
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-check"></i> Place Order';
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
  resetSubmitButton();
  fillOrderProvinces();
  onDeliveryMethod();
  togglePaymentFields();
  // The charge appears as soon as the rates arrive; the form is usable meanwhile.
  loadDeliveryRates().then(() => { renderRateCard(); renderOrderSummary(); });
  renderFulfilment();            // clears any date left from a previous order
  loadStock().then(() => {
    renderFulfilment();
    const problems = cartStockProblems();
    if (problems.length) alert(stockProblemMessage(problems));
  });
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
    feeLine.innerHTML =
      d.method === 'pickup' ? '<span>Pick-up at the farm</span><span>Free</span>'
      : !d.chosen ? ''
      : `<span>Delivery${d.km != null ? ' (' + d.km + ' km)' : ''}</span>` +
        `<span>${d.fee === null ? 'courier — advised later' : d.fee === 0 ? 'Free' : '&#8369;' + d.fee.toFixed(2)}</span>`;
  }
  updatePaymentOptions();
  renderDeliveryCases();
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

  if (!name || !phone || (delivery.method !== 'pickup' && !address)) {
    alert('Please fill in your name, phone number, and delivery address.');
    return;
  }
  if (delivery.method !== 'pickup' && !delivery.chosen) {
    alert('Please choose your province and city / municipality so we can work out the delivery charge.');
    return;
  }

  // Stock may have gone while the form was being filled in, so ask once more.
  await loadStock();
  const problems = cartStockProblems();
  if (problems.length) { alert(stockProblemMessage(problems)); return; }

  const btn = document.getElementById('submit-order-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

  const cart = getCart();
  const orderData = {
    source:          PORTAL_SOURCE,
    customerName:    name,
    customerPhone:   phone,
    customerAddress: delivery.method === 'pickup'
      ? 'Pick-up at the farm'
      : [address, delivery.town, delivery.province].filter(Boolean).join(', '),
    deliveryMethod:  delivery.method,
    province:        delivery.province,
    town:            delivery.town,
    // A request, not a promise: the server moves it forward if the farm cannot
    // pick that soon, and the confirmation says which day it settled on.
    requestedDate:   (document.getElementById('order-date') || {}).value || '',
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

    // 409: the farm sold the last of something between our check and this one.
    if (response.status === 409) {
      const d = await response.json().catch(() => ({}));
      const items = (d.items || []).map(i =>
        `\u2022 ${i.name} \u2014 you asked for ${i.wanted}, ` +
        (i.available ? `only ${i.available} left` : 'none left')).join('\n');
      alert('Sorry, these are no longer available in that quantity:\n\n' + items +
            '\n\nYour cart has been kept \u2014 please adjust it and try again.');
      resetSubmitButton();
      await loadStock();
      return;
    }
    if (!response.ok) throw new Error('Server error ' + response.status);

    const result = await response.json();

    // Success — clear cart, close form, show confirmation
    localStorage.removeItem(CART_KEY);
    updateCartCount();
    document.getElementById('order-form-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    // Reset form for next use
    document.getElementById('online-order-form').reset();
    // reset() clears the fields; the town list and the hidden address block
    // follow from them, so rebuild both rather than leave the last order's
    // towns in a select whose province is now blank.
    resetSubmitButton();
    onOrderProvince();
    onDeliveryMethod();
    togglePaymentFields();
    showOrderConfirmation(result.orderRef, phone, paymentMethod, paymentRef);

  } catch (err) {
    console.error('Order submission failed:', err);
    alert('Sorry, there was a problem submitting your order. Please try again or contact us via WhatsApp.');
    resetSubmitButton();
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

