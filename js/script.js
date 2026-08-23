 const statementSection = document.querySelector('.statement');
  if (statementSection){
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          statementSection.classList.add('in-view');
          observer.unobserve(statementSection);
        }
      });
    }, { threshold: 0.3 });
    observer.observe(statementSection);
  }

  const header = document.getElementById('siteHeader');
  const headerFade = document.getElementById('headerFade');
  window.addEventListener('scroll', () => {
    const isScrolled = window.scrollY > 40;
    header.classList.toggle('scrolled', isScrolled);
    headerFade.classList.toggle('hidden', isScrolled);
  });

  /* ---- Hero: smooth, controlled scroll transition into Our Collections ---- */
  const heroScrollWrap = document.querySelector('.hero-scroll-wrap');
  const heroVideoEl = document.querySelector('.hero video');
  const heroContentEl = document.querySelector('.hero-content');
  const heroScrollCueEl = document.querySelector('.scroll-cue');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (heroScrollWrap && !prefersReducedMotion){
    let heroTicking = false;

    function updateHeroScroll(){
      heroTicking = false;
      const wrapRect = heroScrollWrap.getBoundingClientRect();
      const wrapHeight = heroScrollWrap.offsetHeight;
      const scrolled = -wrapRect.top;
      const progress = Math.min(Math.max(scrolled / wrapHeight, 0), 1);

      /* video: gentle parallax drift, slow zoom-out and soft dim so it blends into what follows */
      const videoShift = progress * 60;
      const videoScale = 1.08 - progress * 0.08;
      if (heroVideoEl){
        heroVideoEl.style.transform = `translate(-50%, calc(-50% + ${videoShift}px)) scale(${videoScale})`;
        heroVideoEl.style.filter = `brightness(${(1 - progress * 0.35).toFixed(3)})`;
      }

      /* text/buttons ease out a little ahead of the visual, then blend into next section */
      const contentProgress = Math.min(progress / 0.7, 1);
      if (heroContentEl){
        heroContentEl.style.opacity = String(Math.max(1 - contentProgress * 1.15, 0));
        heroContentEl.style.transform = `translateY(${contentProgress * -40}px)`;
      }
      if (heroScrollCueEl){
        heroScrollCueEl.style.opacity = String(Math.max(1 - progress * 4, 0));
      }
    }

    function requestHeroUpdate(){
      if (!heroTicking){
        heroTicking = true;
        requestAnimationFrame(updateHeroScroll);
      }
    }

    window.addEventListener('scroll', requestHeroUpdate, { passive: true });
    window.addEventListener('resize', requestHeroUpdate);
    updateHeroScroll();
  }

  const burger = document.getElementById('burgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  burger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    burger.classList.toggle('active', open);
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    burger.classList.remove('active');
    document.body.style.overflow = '';
  }));

  // Keep video muted & playing (defensive against any interruption)
  // Home-page only element — guarded since other pages have no .hero video.
  const heroVideo = document.querySelector('.hero video');
  if (heroVideo){
    heroVideo.muted = true;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) heroVideo.play().catch(()=>{});
    });
    heroVideo.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ---- Shop The Look: single-frame continuous slider (Home page only —
     no .look-slide elsewhere, so this safely does nothing on other pages)
     ----
     Runs on its own on a timer, looping from the last picture back to the
     first — fully automatic, no arrows or dots. Swipe still works on
     touch devices and resets the timer so it doesn't fight the shopper
     right after they swipe manually.
     Written to work with however many .look-slide elements exist. */
  const lookSlides = document.querySelectorAll('.look-slide');
  if (lookSlides.length > 1){
    const lookFrame = document.getElementById('lookSlider');
    let lookIndex = 0;
    let lookAutoTimer = null;

    function showLookSlide(i){
      lookIndex = (i + lookSlides.length) % lookSlides.length;
      lookSlides.forEach((slide, idx) => slide.classList.toggle('active', idx === lookIndex));
    }

    function restartLookAutoplay(){
      if (lookAutoTimer) clearInterval(lookAutoTimer);
      lookAutoTimer = setInterval(() => showLookSlide(lookIndex + 1), 4500);
    }

    if (lookFrame){
      let lookTouchStartX = null;
      lookFrame.addEventListener('touchstart', (e) => {
        lookTouchStartX = e.touches[0].clientX;
      }, { passive: true });
      lookFrame.addEventListener('touchend', (e) => {
        if (lookTouchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - lookTouchStartX;
        if (Math.abs(deltaX) > 40){
          showLookSlide(deltaX < 0 ? lookIndex + 1 : lookIndex - 1);
          restartLookAutoplay();
        }
        lookTouchStartX = null;
      }, { passive: true });
    }

    restartLookAutoplay();
  }

  /* ---- Persistent storage (cart / wishlist / account) ----
     Real multi-page navigation means each page is a fresh document load, so
     state that used to just live in memory for the session (cart, wishlist,
     login) now needs to survive that reload. Same data, same shape — just
     backed by localStorage now instead of only a JS variable. */
  function loadJSON(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value){
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage unavailable (private browsing etc.) — fail silently, page still works */
    }
  }

  /* Returns to the previous page when there's history to go back to, otherwise
     falls back to a fixed destination. Used by every "page" (About/Shop/Product
     Detail/Checkout) for its Close (X) and logo-back controls — in the old
     single-page version these just hid an overlay to reveal whatever was
     underneath; this is the equivalent for real separate pages. */
  function goBack(fallback){
    if (window.history.length > 1){
      window.history.back();
    } else {
      window.location.href = fallback;
    }
  }
  function wireBackControl(closeId, logoId, fallback){
    const closeBtn = document.getElementById(closeId);
    const logoBtn = document.getElementById(logoId);
    if (closeBtn) closeBtn.addEventListener('click', () => goBack(fallback));
    if (logoBtn) logoBtn.addEventListener('click', (e) => { e.preventDefault(); goBack(fallback); });
  }

  /* ---- Cart state ---- */
  let cartItems = loadJSON('mmbrother_cart', []);
  const cartCountEl = document.getElementById('cartCountEl');
  const cartIconBtn = document.getElementById('cartIconBtn');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartClose = document.getElementById('cartClose');
  const cartDrawerBody = document.getElementById('cartDrawerBody');
  const cartEmptyState = document.getElementById('cartEmptyState');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartDrawerCountEl = document.getElementById('cartDrawerCount');
  const checkoutBtn = document.getElementById('checkoutBtn');

  /* Extra cart icon(s) shown right on the About/Shop/Product page topbars
     (the main header's cart icon is hidden there — see the z-index layering
     the page overlays use) so a shopper can open the cart, and get to
     checkout, without backing all the way out to Home first. */
  const extraCartIconBtns = document.querySelectorAll('[data-cart-icon-extra]');
  const extraCartCountEls = document.querySelectorAll('[data-cart-count-extra]');

  function parsePrice(text){
    const n = parseFloat(String(text).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function totalQty(){
    return cartItems.reduce((sum, it) => sum + it.qty, 0);
  }

  function renderCartDrawer(){
    saveJSON('mmbrother_cart', cartItems);

    const qty = totalQty();

    /* header badge + drawer count */
    cartCountEl.textContent = qty;
    extraCartCountEls.forEach(el => { el.textContent = qty; });
    cartDrawerCountEl.textContent = qty > 0 ? `(${qty})` : '';

    /* subtotal */
    const subtotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    cartSubtotalEl.textContent = 'Rs ' + subtotal.toLocaleString('en-US');

    /* checkout button state */
    const coBtn = document.getElementById('checkoutBtn');
    const coEmptyNote = document.getElementById('checkoutEmptyNote');
    if (coBtn){
      coBtn.disabled = cartItems.length === 0;
      coBtn.classList.toggle('disabled', cartItems.length === 0);
    }
    if (coEmptyNote){
      coEmptyNote.classList.toggle('show', cartItems.length === 0);
    }

    /* items list */
    cartDrawerBody.querySelectorAll('.cart-item').forEach(el => el.remove());

    if (cartItems.length === 0){
      cartEmptyState.style.display = 'flex';
      return;
    }
    cartEmptyState.style.display = 'none';

    cartItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="cart-item-img"><img src="${item.image}" alt="${item.name}"></div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">Rs ${item.price.toLocaleString('en-US')}</div>
          <div class="cart-item-qty">Qty: ${item.qty}</div>
        </div>
        <button class="cart-item-remove" aria-label="Remove ${item.name}" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="20" y2="20"></line><line x1="20" y1="4" x2="4" y2="20"></line></svg>
        </button>
      `;
      cartDrawerBody.appendChild(row);
    });

    cartDrawerBody.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        cartItems = cartItems.filter(it => it.id !== id);
        renderCartDrawer();
      });
    });
  }

  function addToCart(product){
    const existing = cartItems.find(it => it.id === product.id);
    if (existing){
      existing.qty += 1;
    } else {
      cartItems.push({ ...product, qty: 1 });
    }
    renderCartDrawer();

    cartCountEl.classList.remove('pulse');
    void cartCountEl.offsetWidth; // restart animation
    cartCountEl.classList.add('pulse');
    cartIconBtn.classList.remove('pulse');
    void cartIconBtn.offsetWidth;
    cartIconBtn.classList.add('pulse');

    extraCartIconBtns.forEach(btn => {
      btn.classList.remove('pulse');
      void btn.offsetWidth;
      btn.classList.add('pulse');
    });
    extraCartCountEls.forEach(el => {
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
    });
  }

  function openCart(){
    cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeCart(){
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  cartIconBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openCart();
  });
  extraCartIconBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openCart();
    });
  });
  cartClose.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', (e) => {
    if (e.target === cartOverlay) closeCart();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartOverlay.classList.contains('open')) closeCart();
  });

  /* Cart drawer's own "CHECKOUT" button — takes the shopper to the real
     checkout page instead of opening an in-place overlay. */
  if (checkoutBtn){
    checkoutBtn.addEventListener('click', () => {
      if (cartItems.length === 0) return;
      window.location.href = 'checkout.html';
    });
  }

  function flashAdded(btn){
    if (btn.classList.contains('added')) return;
    const original = btn.textContent;
    btn.classList.add('added');
    btn.textContent = 'ADDED ✓';
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('added');
    }, 1200);
  }

  /* ---- Checkout page ----
     Everything below only exists on checkout.html (checkoutForm is only
     present there), so it's wrapped in a guard: on every other page this
     whole block is skipped, nothing runs, nothing errors. */
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm){
    const checkoutOverlay = document.getElementById('checkoutOverlay');
    const checkoutFormView = document.getElementById('checkoutFormView');
    const checkoutConfirmView = document.getElementById('checkoutConfirmView');
    const checkoutSteps = document.getElementById('checkoutSteps');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const checkoutContinueBtn = document.getElementById('checkoutContinueBtn');
    const coItemsList = document.getElementById('coItemsList');
    const coEmptySummary = document.getElementById('coEmptySummary');
    const coItemCount = document.getElementById('coItemCount');
    const coSubtotalEl = document.getElementById('coSubtotal');
    const coShippingEl = document.getElementById('coShipping');
    const coTotalEl = document.getElementById('coTotal');
    const SHIPPING_FLAT = 250;

    function renderCheckoutSummary(){
      coItemsList.innerHTML = '';
      const qty = totalQty();
      coItemCount.textContent = qty + (qty === 1 ? ' ITEM' : ' ITEMS');

      if (cartItems.length === 0){
        coEmptySummary.style.display = 'block';
        placeOrderBtn.disabled = true;
      } else {
        coEmptySummary.style.display = 'none';
        placeOrderBtn.disabled = false;
      }

      cartItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'co-item';
        const sizeLabel = item.size ? item.size : 'One Size';
        row.innerHTML = `
          <div class="co-item-thumb">${item.image ? `<img src="${item.image}" alt="${item.name}">` : 'MM'}</div>
          <div class="co-item-info">
            <div class="co-item-name">${item.name}</div>
            <div class="co-item-meta">Size: ${sizeLabel} &nbsp;•&nbsp; Qty: ${item.qty}</div>
            <div class="co-item-unit">Rs ${item.price.toLocaleString('en-US')} each</div>
          </div>
          <div class="co-item-price">Rs ${(item.price * item.qty).toLocaleString('en-US')}</div>
        `;
        coItemsList.appendChild(row);
      });

      const subtotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
      const shipping = cartItems.length ? SHIPPING_FLAT : 0;
      coSubtotalEl.textContent = 'Rs ' + subtotal.toLocaleString('en-US');
      coShippingEl.textContent = 'Rs ' + shipping.toLocaleString('en-US');
      coTotalEl.textContent = 'Rs ' + (subtotal + shipping).toLocaleString('en-US');
    }

    function setCheckoutStep(stepNum){
      checkoutSteps.querySelectorAll('.co-step').forEach(stepEl => {
        const n = parseInt(stepEl.getAttribute('data-step'), 10);
        stepEl.classList.remove('active', 'done');
        if (n < stepNum) stepEl.classList.add('done');
        if (n === stepNum) stepEl.classList.add('active');
      });
    }

    /* ---- Validation + submit ---- */
    function setFieldError(id, message){
      const field = document.getElementById('co' + id.charAt(0).toUpperCase() + id.slice(1)).closest('.co-field');
      const errorEl = document.getElementById('err-' + id);
      if (message){
        field.classList.add('invalid');
        errorEl.textContent = message;
      } else {
        field.classList.remove('invalid');
        errorEl.textContent = '';
      }
    }

    function validateCheckoutForm(){
      let valid = true;
      const fullName = document.getElementById('coFullName').value.trim();
      const email = document.getElementById('coEmail').value.trim();
      const phone = document.getElementById('coPhone').value.trim();
      const address = document.getElementById('coAddress').value.trim();
      const city = document.getElementById('coCity').value.trim();

      if (!fullName){ setFieldError('fullName', 'Full name is required.'); valid = false; }
      else setFieldError('fullName', '');

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email){ setFieldError('email', 'Email is required.'); valid = false; }
      else if (!emailPattern.test(email)){ setFieldError('email', 'Enter a valid email.'); valid = false; }
      else setFieldError('email', '');

      const phoneDigits = phone.replace(/[^0-9]/g, '');
      if (!phone){ setFieldError('phone', 'Phone number is required.'); valid = false; }
      else if (phoneDigits.length < 10){ setFieldError('phone', 'Enter a valid phone number.'); valid = false; }
      else setFieldError('phone', '');

      if (!address){ setFieldError('address', 'Delivery address is required.'); valid = false; }
      else setFieldError('address', '');

      if (!city){ setFieldError('city', 'City is required.'); valid = false; }
      else setFieldError('city', '');

      return valid;
    }

    ['coFullName','coEmail','coPhone','coAddress','coCity'].forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => {
        if (el.closest('.co-field').classList.contains('invalid')) validateCheckoutForm();
      });
    });

    function generateOrderNumber(){
      return 'MM-' + Math.floor(100000 + Math.random() * 900000);
    }

    /* Sends the order confirmation by email via EmailJS, using the customer's actual
       Cart/Checkout data — real product names, sizes, exact quantities, price, order
       number, name, phone and delivery address for THIS order only. Nothing here is
       hardcoded/static; every value is built fresh from the order passed in.
       WhatsApp is not used for this — a chat link can't reliably deliver full structured
       order details, so email is the confirmation channel.
       Connected to the "Order Confirmation" template created in EmailJS. */
    const EMAILJS_ORDER_SERVICE_ID = 'service_aqgi16h';
    const EMAILJS_ORDER_TEMPLATE_ID = 'template_d9233eu';
    const EMAILJS_ORDER_PUBLIC_KEY = 'M_S8sMK5UUc2jbtPa';

    /* Product photos on this site are embedded as base64 data (not hosted image URLs).
       Those are too large to pass through the email API, so only a real hosted image
       URL is sent for a product; otherwise the image field is left blank for that item
       (name, size, qty and price are unaffected). */
    function emailSafeImageUrl(url){
      return (url && !url.startsWith('data:')) ? url : '';
    }

    async function sendOrderConfirmationEmail(order){
      if (typeof emailjs === 'undefined') return { skipped: true };

      emailjs.init({ publicKey: EMAILJS_ORDER_PUBLIC_KEY });

      /* Build a line per product — this order's actual products, sizes & exact quantities. */
      const itemsList = order.items
        .map(it => `${it.name}${it.size ? ' (Size: ' + it.size + ')' : ''} — Qty: ${it.qty} — Rs ${(it.price * it.qty).toLocaleString('en-US')} each: Rs ${it.price.toLocaleString('en-US')}`)
        .join('\n');

      /* Structured array too, for templates that loop over items individually
         (EmailJS Dynamic Content / {{#each order_items}}). Each item includes a few
         common field-name aliases since the template's exact field names aren't visible
         to us here. */
      const orderItemsForTemplate = order.items.map(it => ({
        name: it.name,
        product_name: it.name,
        size: it.size || 'One Size',
        qty: it.qty,
        quantity: it.qty,
        unit_price: 'Rs ' + it.price.toLocaleString('en-US'),
        price: 'Rs ' + it.price.toLocaleString('en-US'),
        line_total: 'Rs ' + (it.price * it.qty).toLocaleString('en-US'),
        total: 'Rs ' + (it.price * it.qty).toLocaleString('en-US'),
        image: emailSafeImageUrl(it.image)
      }));

      /* EmailJS's built-in "Order Confirmation" gallery template (which this template's
         layout — Order ID / Order Details / Shipping / Total / Customer Details — matches)
         expects the product list under a variable literally named "orders", with each
         entry using the fields image_url, name, units, price. This is the piece that was
         missing before; everything already working (Order ID, Shipping, Total, Name,
         Email) is untouched. */
      const ordersForTemplate = order.items.map(it => ({
        image_url: emailSafeImageUrl(it.image),
        name: it.name + (it.size ? ` (Size: ${it.size})` : ''),
        units: it.qty,
        price: 'Rs ' + it.price.toLocaleString('en-US')
      }));

      const orderIdStr = order.orderNumber;
      const totalStr = 'Rs ' + order.total.toLocaleString('en-US');
      const shippingStr = 'Rs ' + order.shipping.toLocaleString('en-US');
      const subtotalStr = 'Rs ' + order.subtotal.toLocaleString('en-US');
      const postalStr = order.postal || '';

      /* Sent under several common variable-name spellings so this fills in correctly
         no matter which exact placeholder names the EmailJS template body uses
         (e.g. {{order_id}} vs {{order_number}}, {{email}} vs {{to_email}}). */
      const templateParams = {
        // recipient routing (EmailJS "To Email" field)
        to_email: order.email,
        email: order.email,

        // customer
        customer_name: order.fullName,
        name: order.fullName,
        customer_email: order.email,
        customer_phone: order.phone,
        phone: order.phone,

        // order id
        order_number: orderIdStr,
        order_id: orderIdStr,
        orderId: orderIdStr,

        // items
        items_list: itemsList,
        items: itemsList,
        products: itemsList,
        order_items: orderItemsForTemplate,
        orders: ordersForTemplate,

        // totals
        order_subtotal: subtotalStr,
        subtotal: subtotalStr,
        shipping_cost: shippingStr,
        shipping: shippingStr,
        order_total: totalStr,
        total: totalStr,

        // delivery
        delivery_address: order.address,
        address: order.address,
        delivery_city: order.city,
        city: order.city,
        delivery_postal: postalStr,
        postal_code: postalStr,
        postal: postalStr
      };

      /* Debug logging: shows exactly what is being sent to EmailJS, and the exact success
         or error response EmailJS returns — check the browser console after placing a test
         order to see whether the request actually went out and what came back. */
      console.log('[EmailJS] Sending order confirmation:', {
        service: EMAILJS_ORDER_SERVICE_ID,
        template: EMAILJS_ORDER_TEMPLATE_ID,
        params: templateParams
      });

      try {
        const response = await emailjs.send(EMAILJS_ORDER_SERVICE_ID, EMAILJS_ORDER_TEMPLATE_ID, templateParams);
        console.log('[EmailJS] Order confirmation SENT — status:', response.status, 'text:', response.text);
        return { sent: true, response };
      } catch (err) {
        console.error('[EmailJS] Order confirmation FAILED — status:', err && err.status, 'text:', err && err.text, 'raw error:', err);
        return { sent: false, error: err };
      }
    }

    /* Confirmation sound — embedded audio file (base64, no external/separate file).
       Plays only when an order is successfully confirmed. */
    const orderConfirmSoundEl = document.getElementById('orderConfirmSound');
    function playOrderConfirmedSound(){
      if (!orderConfirmSoundEl) return;
      try{
        orderConfirmSoundEl.currentTime = 0;
        const playPromise = orderConfirmSoundEl.play();
        if (playPromise && playPromise.catch) playPromise.catch(() => {});
      } catch (err) { /* audio not available — fail silently */ }
    }

    function restartConfirmIconAnimation(){
      const icon = document.getElementById('coConfirmIcon');
      if (!icon) return;
      const clone = icon.cloneNode(true);
      icon.parentNode.replaceChild(clone, icon);
      clone.id = 'coConfirmIcon';
    }

    /* Renders the exact products & quantities from this order into the confirmation view. */
    function renderConfirmItems(items){
      const list = document.getElementById('coConfirmItemsList');
      list.innerHTML = '';
      items.forEach(it => {
        const sizeLabel = it.size ? it.size : 'One Size';
        const row = document.createElement('div');
        row.className = 'co-confirm-item';
        row.innerHTML = `
          <div class="co-confirm-item-name">${it.name}<span class="co-confirm-item-qty"> &middot; Size: ${sizeLabel} &middot; Qty: ${it.qty}</span></div>
          <div class="co-confirm-item-price">Rs ${(it.price * it.qty).toLocaleString('en-US')}</div>
        `;
        list.appendChild(row);
      });
    }

    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (cartItems.length === 0) return;

      /* Safety net: Order Confirmation must never go through for a cart item
         that needed a Size/Waist but doesn't have one recorded — every normal
         path (Product Detail, Quick View) already enforces this before the
         item reaches the cart, so this only catches an already-invalid cart. */
      const coSizeError = document.getElementById('coSizeError');
      const missingSizeItem = cartItems.find(it => sizeIsRequiredFor(it.category) && !it.size);
      if (missingSizeItem){
        if (coSizeError){
          coSizeError.textContent = missingSizeItem.name + ' needs a ' + sizeLabelFor(missingSizeItem.category).toLowerCase() + ' selected — please remove and re-add it with a size before placing the order.';
          coSizeError.classList.add('show');
        }
        return;
      }
      if (coSizeError){ coSizeError.classList.remove('show'); coSizeError.textContent = ''; }

      if (!validateCheckoutForm()){
        const firstInvalid = checkoutForm.querySelector('.co-field.invalid input, .co-field.invalid textarea');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const fullName = document.getElementById('coFullName').value.trim();
      const email = document.getElementById('coEmail').value.trim();
      const phone = document.getElementById('coPhone').value.trim();
      const address = document.getElementById('coAddress').value.trim();
      const city = document.getElementById('coCity').value.trim();
      const postal = document.getElementById('coPostal').value.trim();
      const orderNumber = generateOrderNumber();

      /* Snapshot the actual cart contents (exact products, sizes, quantities, prices, images)
         before the cart is cleared — this is what both the on-screen confirmation and the
         confirmation email are built from. */
      const orderItems = cartItems.map(it => ({
        name: it.name, qty: it.qty, price: it.price, size: it.size || '', image: it.image || ''
      }));
      const orderSubtotal = orderItems.reduce((sum, it) => sum + it.price * it.qty, 0);
      const orderShipping = orderItems.length ? SHIPPING_FLAT : 0;
      const orderTotal = orderSubtotal + orderShipping;

      document.getElementById('coConfirmName').textContent = ', ' + fullName;
      document.getElementById('coConfirmEmail').textContent = email;
      document.getElementById('coOrderNumber').textContent = orderNumber;
      document.getElementById('coConfirmTotal').textContent = 'Rs ' + orderTotal.toLocaleString('en-US');
      renderConfirmItems(orderItems);

      checkoutFormView.style.display = 'none';
      restartConfirmIconAnimation();
      checkoutConfirmView.classList.add('show');
      setCheckoutStep(3);
      checkoutOverlay.scrollTo({ top: 0 });
      playOrderConfirmedSound();

      /* Send the order confirmation by email — with this order's actual products, sizes,
         exact quantities, price, total and delivery details — rather than relying on
         WhatsApp, since WhatsApp can't reliably carry full structured order details.
         This runs in the background and never blocks or delays the on-screen confirmation.
         Result is logged to the console so it's clear whether EmailJS actually sent it. */
      console.log('[EmailJS] Order placed — order number', orderNumber, '— triggering confirmation email now.');
      sendOrderConfirmationEmail({
        fullName, email, phone, address, city, postal,
        orderNumber, items: orderItems,
        subtotal: orderSubtotal, shipping: orderShipping, total: orderTotal
      }).then(result => {
        console.log('[EmailJS] sendOrderConfirmationEmail() resolved with:', result);
      });

      /* clear cart after successful order */
      cartItems = [];
      renderCartDrawer();
      checkoutForm.reset();
      ['fullName','email','phone','address','city'].forEach(id => setFieldError(id, ''));
    });

    /* "CONTINUE SHOPPING" on the confirmation view — takes the shopper to the Shop page. */
    checkoutContinueBtn.addEventListener('click', () => {
      window.location.href = 'shop.html';
    });

    /* The page loads already showing the Delivery Details form (step 2) with the
       Cart step marked done — that's the static markup's default state, matching
       what the old openCheckout() used to set up. All that's needed on load is to
       fill in the order summary from the persisted cart. */
    renderCheckoutSummary();

    wireBackControl('checkoutClose', 'checkoutLogoBack', 'index.html');

    /* Same bfcache concern as above: if this page is restored from cache
       (e.g. Back button after leaving mid-checkout), re-pull the cart and
       redraw the order summary so it can't show stale/emptied-out totals. */
    window.addEventListener('pageshow', () => {
      cartItems = loadJSON('mmbrother_cart', []);
      renderCheckoutSummary();
    });
  }

  /* ---- Scope: Featured Collection, Best Sellers & Latest Drop cards ----
     On the homepage these are the visible cards. On Shop/Product pages the same
     markup is included hidden, purely so this catalog (and therefore Search,
     Quick View, the Shop grid and Product Detail rendering) has the same data,
     in the same order, everywhere it's needed. */
  const scopedCards = document.querySelectorAll('.featured .product-card, .bestsellers .product-card, .latest-drop .product-card');

  /* Product-card helpers — used by Quick View (every page) and by the Shop /
     Product Detail pages, so these stay available everywhere. */
  function getCardData(card){
    const img = card.querySelector('.product-image img');
    const name = card.querySelector('.product-name');
    const price = card.querySelector('.product-price');
    return {
      image: img ? img.src : '',
      name: name ? name.textContent.trim() : 'MM Brother Item',
      priceText: price ? price.textContent.trim() : '',
      priceValue: parsePrice(price ? price.textContent : '0'),
      category: card.getAttribute('data-category') || ''
    };
  }

  /* Size options per product category. T-Shirts get a compulsory Size
     selector; Pants get a compulsory Waist selector; everything else keeps
     the existing optional S/M/L/XL sizing. */
  const SIZE_OPTIONS = {
    tshirt: ['S', 'M', 'L', 'XL'],
    pants: ['30', '32', '34', '36', '38'],
    default: ['S', 'M', 'L', 'XL']
  };
  function sizeOptionsFor(category){
    return SIZE_OPTIONS[category] || SIZE_OPTIONS.default;
  }
  function sizeIsRequiredFor(category){
    return category === 'tshirt' || category === 'pants';
  }
  function sizeLabelFor(category){
    return category === 'pants' ? 'WAIST' : 'SIZE';
  }

  /* ---- Wishlist state ---- */
  let wishlistItems = loadJSON('mmbrother_wishlist', []);
  const wishlistCountEl = document.getElementById('wishlistCountEl');
  const wishlistIconBtn = document.getElementById('wishlistIconBtn');
  const wishlistOverlay = document.getElementById('wishlistOverlay');
  const wishlistClose = document.getElementById('wishlistClose');
  const wishlistDrawerBody = document.getElementById('wishlistDrawerBody');
  const wishlistEmptyState = document.getElementById('wishlistEmptyState');
  const wishlistDrawerCountEl = document.getElementById('wishlistDrawerCount');

  function renderWishlistDrawer(){
    saveJSON('mmbrother_wishlist', wishlistItems);

    const count = wishlistItems.length;

    wishlistCountEl.textContent = count;
    wishlistDrawerCountEl.textContent = count > 0 ? `(${count})` : '';

    wishlistDrawerBody.querySelectorAll('.wishlist-item').forEach(el => el.remove());

    if (wishlistItems.length === 0){
      wishlistEmptyState.style.display = 'flex';
      return;
    }
    wishlistEmptyState.style.display = 'none';

    wishlistItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'wishlist-item';
      row.innerHTML = `
        <div class="wishlist-item-img"><img src="${item.image}" alt="${item.name}"></div>
        <div class="wishlist-item-info">
          <div class="wishlist-item-name">${item.name}</div>
          <div class="wishlist-item-price">Rs ${item.price.toLocaleString('en-US')}</div>
          <div class="wishlist-item-actions">
            <button class="wishlist-item-add" data-id="${item.id}">ADD TO CART</button>
            <button class="wishlist-item-remove" data-id="${item.id}">REMOVE FROM WISHLIST</button>
          </div>
        </div>
      `;
      wishlistDrawerBody.appendChild(row);
    });

    wishlistDrawerBody.querySelectorAll('.wishlist-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        wishlistItems = wishlistItems.filter(it => it.id !== id);
        const card = scopedCards[parseInt(id.replace('card-', ''), 10)];
        const heart = card ? card.querySelector('.wishlist-btn') : null;
        if (heart) heart.classList.remove('active');
        renderWishlistDrawer();
      });
    });

    wishlistDrawerBody.querySelectorAll('.wishlist-item-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = wishlistItems.find(it => it.id === id);
        if (!item) return;

        /* Wishlist items don't carry a size — for a T-Shirt/Pants item this
           button can't add straight to cart (that would skip the required
           Size/Waist selection). Send the shopper to that product's page
           instead, where the same required-selection flow as everywhere
           else applies, rather than adding an item with no size. */
        if (sizeIsRequiredFor(item.category)){
          const idx = parseInt(id.replace('card-', ''), 10);
          if (btn.classList.contains('added')) return;
          const original = btn.textContent;
          btn.classList.add('added');
          btn.textContent = 'SELECT ' + sizeLabelFor(item.category);
          setTimeout(() => {
            if (!isNaN(idx)) window.location.href = 'product.html?id=' + idx;
          }, 700);
          return;
        }

        addToCart({ id: item.id, name: item.name, price: item.price, image: item.image });
        flashAdded(btn);
      });
    });
  }

  function openWishlist(){
    wishlistOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeWishlist(){
    wishlistOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  wishlistIconBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openWishlist();
  });
  wishlistClose.addEventListener('click', closeWishlist);
  wishlistOverlay.addEventListener('click', (e) => {
    if (e.target === wishlistOverlay) closeWishlist();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wishlistOverlay.classList.contains('open')) closeWishlist();
  });

  /* Wishlist toggle — click to add, click again to remove. Hearts start reflecting
     whatever is already in the (persisted) wishlist, so it stays in sync across pages. */
  scopedCards.forEach((card, idx) => {
    const heart = card.querySelector('.wishlist-btn');
    if (heart){
      if (wishlistItems.some(it => it.id === 'card-' + idx)) heart.classList.add('active');

      heart.addEventListener('click', (e) => {
        e.preventDefault();
        const id = 'card-' + idx;
        const isActive = heart.classList.contains('active');

        if (isActive){
          heart.classList.remove('active');
          wishlistItems = wishlistItems.filter(it => it.id !== id);
        } else {
          heart.classList.add('active');
          const img = card.querySelector('.product-image img');
          const name = card.querySelector('.product-name');
          const price = card.querySelector('.product-price');
          wishlistItems.push({
            id,
            name: name ? name.textContent.trim() : 'MM Brother Item',
            price: parsePrice(price ? price.textContent : '0'),
            image: img ? img.src : '',
            category: card.getAttribute('data-category') || ''
          });

          wishlistCountEl.classList.remove('pulse');
          void wishlistCountEl.offsetWidth;
          wishlistCountEl.classList.add('pulse');
          wishlistIconBtn.classList.remove('pulse');
          void wishlistIconBtn.offsetWidth;
          wishlistIconBtn.classList.add('pulse');
        }
        renderWishlistDrawer();
      });
    }
  });

  /* ---- About page — Close (X) and logo both just go back. The "SHOP NOW" link
     on the About page is a plain href="shop.html" now, so it needs no JS. ---- */
  wireBackControl('aboutClose', 'aboutLogoBack', 'index.html');

  /* ---- Shop page (shop.html only — shopPageGrid only exists there) ---- */
  const shopPageGrid = document.getElementById('shopPageGrid');
  if (shopPageGrid){
    scopedCards.forEach((card, idx) => {
      const data = getCardData(card);
      const el = document.createElement('div');
      el.className = 'shop-page-card';
      el.innerHTML = `
        <div class="spc-thumb">
          <img src="${data.image}" alt="${data.name}">
          <div class="spc-add-overlay">
            <span>ADD TO CART</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          </div>
        </div>
        <div class="spc-name">${data.name}</div>
        <div class="spc-price">${data.priceText}</div>
      `;
      el.addEventListener('click', () => { window.location.href = 'product.html?id=' + idx; });
      shopPageGrid.appendChild(el);
    });

    wireBackControl('shopClose', 'shopLogoBack', 'index.html');
  }

  /* ---- Product Detail page (product.html only — pdpOverlay only exists there) ----
     Renders whichever product the ?id= in the URL points to, on page load —
     the equivalent of the old openProductDetail(idx) being called automatically
     instead of from a click. */
  const pdpOverlay = document.getElementById('pdpOverlay');
  if (pdpOverlay){
    const pdpImage = document.getElementById('pdpImage');
    const pdpName = document.getElementById('pdpName');
    const pdpPrice = document.getElementById('pdpPrice');
    const pdpDesc = document.getElementById('pdpDesc');
    const pdpSizesLabel = document.getElementById('pdpSizesLabel');
    const pdpSizesWrap = document.getElementById('pdpSizes');
    const pdpAddCartBtn = document.getElementById('pdpAddCartBtn');
    const pdpRelatedGrid = document.getElementById('pdpRelatedGrid');

    const pdpSizeError = document.getElementById('pdpSizeError');

    function renderProductDetailPage(idx){
      const card = scopedCards[idx];
      if (!card) return;
      const data = getCardData(card);

      pdpImage.src = data.image;
      pdpImage.alt = data.name;
      pdpName.textContent = data.name;
      pdpPrice.textContent = data.priceText;
      pdpDesc.textContent = 'A signature MM Brother piece, cut for a bold, confident fit and made to move with you — premium materials, clean lines, built to last.';

      const pdpRequiresSize = sizeIsRequiredFor(data.category);
      pdpSizesLabel.textContent = pdpRequiresSize
        ? 'SELECT ' + sizeLabelFor(data.category)
        : 'AVAILABLE SIZES';
      pdpSizesWrap.innerHTML = sizeOptionsFor(data.category)
        .map(size => `<button type="button" class="pdp-size">${size}</button>`)
        .join('');
      pdpSizesWrap.classList.remove('needs-selection');
      if (pdpSizeError){ pdpSizeError.classList.remove('show'); pdpSizeError.textContent = ''; }

      pdpRelatedGrid.innerHTML = '';
      let added = 0;
      scopedCards.forEach((otherCard, otherIdx) => {
        if (otherIdx === idx || added >= 4) return;
        const otherData = getCardData(otherCard);
        const el = document.createElement('div');
        el.className = 'shop-page-card';
        el.innerHTML = `
          <div class="spc-thumb"><img src="${otherData.image}" alt="${otherData.name}"></div>
          <div class="spc-name">${otherData.name}</div>
          <div class="spc-price">${otherData.priceText}</div>
        `;
        el.addEventListener('click', () => { window.location.href = 'product.html?id=' + otherIdx; });
        pdpRelatedGrid.appendChild(el);
        added++;
      });

      /* Add to Cart stays clickable either way — a disabled button gives no
         feedback about why nothing happened (especially on mobile, with no
         hover state). Clicking without a required Size/Waist selected shows
         a clear inline message and highlights the size row instead; the add
         only goes through once a selection is made. */
      pdpAddCartBtn.onclick = () => {
        const selectedBtn = pdpSizesWrap.querySelector('.pdp-size.selected');
        if (pdpRequiresSize && !selectedBtn){
          pdpSizesWrap.classList.remove('needs-selection');
          void pdpSizesWrap.offsetWidth;
          pdpSizesWrap.classList.add('needs-selection');
          if (pdpSizeError){
            pdpSizeError.textContent = 'Please select a ' + sizeLabelFor(data.category).toLowerCase() + ' before adding to cart.';
            pdpSizeError.classList.add('show');
          }
          return;
        }
        if (pdpSizeError){ pdpSizeError.classList.remove('show'); pdpSizeError.textContent = ''; }
        const selectedSize = selectedBtn ? selectedBtn.textContent.trim() : 'One Size';
        addToCart({
          id: 'pdp-' + data.name + '-' + selectedSize,
          name: data.name,
          price: data.priceValue,
          image: data.image,
          size: selectedSize,
          category: data.category
        });
        flashAdded(pdpAddCartBtn);
      };
    }

    pdpSizesWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.pdp-size');
      if (!btn) return;
      pdpSizesWrap.querySelectorAll('.pdp-size').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      pdpSizesWrap.classList.remove('needs-selection');
      if (pdpSizeError){ pdpSizeError.classList.remove('show'); pdpSizeError.textContent = ''; }
    });

    wireBackControl('pdpClose', 'pdpLogoBack', 'shop.html');

    const requestedIdx = parseInt(new URLSearchParams(window.location.search).get('id'), 10);
    renderProductDetailPage(isNaN(requestedIdx) ? 0 : requestedIdx);
  }

  /* Every "SHOP NOW" button on a product card (Home's Featured/Best Sellers/Latest
     Drop, and the same cards hidden on Shop/Product pages) is a plain
     href="product.html?id=N" link baked in per-card, so it needs no JS at all. */

  /* ---- Quick View ---- */
  const qvOverlay = document.getElementById('qvOverlay');
  const qvImage = document.getElementById('qvImage');
  const qvName = document.getElementById('qvName');
  const qvPrice = document.getElementById('qvPrice');
  const qvSizesLabel = document.getElementById('qvSizesLabel');
  const qvSizesWrap = document.getElementById('qvSizes');
  const qvSizeError = document.getElementById('qvSizeError');
  const qvAddBtn = document.getElementById('qvAddBtn');
  const qvClose = document.getElementById('qvClose');
  let qvRequiresSize = false;
  let qvCategory = '';

  function openQuickView(card){
    const img = card.querySelector('.product-image img');
    const name = card.querySelector('.product-name');
    const price = card.querySelector('.product-price');
    const category = card.getAttribute('data-category') || '';
    qvCategory = category;
    qvImage.src = img ? img.src : '';
    qvImage.alt = img ? img.alt : '';
    qvName.textContent = name ? name.textContent : '';
    qvPrice.textContent = price ? price.textContent : '';

    qvRequiresSize = sizeIsRequiredFor(category);
    qvSizesLabel.textContent = qvRequiresSize
      ? 'SELECT ' + sizeLabelFor(category)
      : 'SELECT SIZE';
    qvSizesWrap.innerHTML = sizeOptionsFor(category)
      .map(size => `<button class="qv-size">${size}</button>`)
      .join('');
    qvSizesWrap.classList.remove('needs-selection');
    if (qvSizeError){ qvSizeError.classList.remove('show'); qvSizeError.textContent = ''; }

    qvAddBtn.textContent = 'ADD TO CART';
    qvAddBtn.classList.remove('added');
    qvOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeQuickView(){
    qvOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  scopedCards.forEach(card => {
    const qvBtn = card.querySelector('.quickview-btn');
    if (qvBtn){
      qvBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openQuickView(card);
      });
    }
  });

  qvSizesWrap.addEventListener('click', (e) => {
    const sizeBtn = e.target.closest('.qv-size');
    if (!sizeBtn) return;
    qvSizesWrap.querySelectorAll('.qv-size').forEach(s => s.classList.remove('selected'));
    sizeBtn.classList.add('selected');
    qvSizesWrap.classList.remove('needs-selection');
    if (qvSizeError){ qvSizeError.classList.remove('show'); qvSizeError.textContent = ''; }
  });

  /* Same approach as the Product Detail page: the button stays clickable
     (no silent disabled state) and clicking without a required selection
     shows a clear inline message plus highlights the size row, on both
     desktop and mobile — the add only proceeds once a size is chosen. */
  qvAddBtn.addEventListener('click', () => {
    const selectedSizeBtn = qvSizesWrap.querySelector('.qv-size.selected');
    if (qvRequiresSize && !selectedSizeBtn){
      qvSizesWrap.classList.remove('needs-selection');
      void qvSizesWrap.offsetWidth;
      qvSizesWrap.classList.add('needs-selection');
      if (qvSizeError){
        qvSizeError.textContent = 'Please select a ' + sizeLabelFor(qvCategory).toLowerCase() + ' before adding to cart.';
        qvSizeError.classList.add('show');
      }
      return;
    }
    if (qvSizeError){ qvSizeError.classList.remove('show'); qvSizeError.textContent = ''; }
    const selectedSize = selectedSizeBtn ? selectedSizeBtn.textContent.trim() : null;
    const nameText = qvName.textContent.trim();
    addToCart({
      id: 'qv-' + nameText + (selectedSize ? '-' + selectedSize : ''),
      name: nameText,
      price: parsePrice(qvPrice.textContent),
      image: qvImage.src,
      size: selectedSize || 'One Size',
      category: qvCategory
    });
    flashAdded(qvAddBtn);
    setTimeout(closeQuickView, 900);
  });

  qvClose.addEventListener('click', closeQuickView);
  qvOverlay.addEventListener('click', (e) => {
    if (e.target === qvOverlay) closeQuickView();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && qvOverlay.classList.contains('open')) closeQuickView();
  });

  /* ---- Search ---- */
  const searchIconBtn = document.getElementById('searchIconBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose = document.getElementById('searchClose');
  const searchInput = document.getElementById('searchInput');
  const searchBody = document.getElementById('searchBody');

  const searchSectionLabels = {
    'featured': 'Featured Collection',
    'bestsellers': 'Best Sellers',
    'latest-drop': 'Latest Drop'
  };

  function escapeHtml(str){
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Build a searchable index from the existing Featured / Best Sellers / Latest Drop cards */
  const searchIndex = Array.from(scopedCards).map(card => {
    const parentSection = card.closest('section');
    const sectionKey = parentSection
      ? Array.from(parentSection.classList).find(c => searchSectionLabels[c])
      : null;
    const nameEl = card.querySelector('.product-name');
    const priceEl = card.querySelector('.product-price');
    const imgEl = card.querySelector('.product-image img');
    return {
      card,
      name: nameEl ? nameEl.textContent.trim() : '',
      price: priceEl ? priceEl.textContent.trim() : '',
      image: imgEl ? imgEl.src : '',
      alt: imgEl ? imgEl.alt : '',
      tag: sectionKey ? searchSectionLabels[sectionKey] : ''
    };
  });

  function openSearch(){
    searchOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => searchInput.focus(), 150);
  }

  function closeSearch(){
    searchOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderSearchResults(query){
    const q = query.trim().toLowerCase();

    if (!q){
      searchBody.innerHTML = '<p class="search-hint">Start typing to search Featured Collection, Best Sellers &amp; Latest Drop.</p>';
      return;
    }

    const matches = searchIndex.filter(item => item.name.toLowerCase().includes(q));

    if (matches.length === 0){
      searchBody.innerHTML = '<div class="search-empty"><span class="search-empty-title">No Products Found</span>Try a different search term.</div>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'search-results';

    matches.forEach(item => {
      const resultBtn = document.createElement('button');
      resultBtn.type = 'button';
      resultBtn.className = 'search-result-card';
      resultBtn.innerHTML = `
        <div class="search-result-img"><img src="${item.image}" alt="${escapeHtml(item.alt)}"></div>
        <div class="search-result-info">
          <div class="search-result-tag">${escapeHtml(item.tag)}</div>
          <div class="search-result-name">${escapeHtml(item.name)}</div>
          <div class="search-result-price">${escapeHtml(item.price)}</div>
        </div>`;
      resultBtn.addEventListener('click', () => {
        closeSearch();
        setTimeout(() => openQuickView(item.card), 250);
      });
      grid.appendChild(resultBtn);
    });

    searchBody.innerHTML = '';
    searchBody.appendChild(grid);
  }

  if (searchIconBtn){
    searchIconBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSearch();
    });
  }

  searchClose.addEventListener('click', closeSearch);
  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchOverlay.classList.contains('open')) closeSearch();
  });
  searchInput.addEventListener('input', () => renderSearchResults(searchInput.value));

  /* ---- Account Panel ---- */
  const acctOverlay = document.getElementById('acctOverlay');
  const acctPanel = document.getElementById('acctPanel');
  const acctClose = document.getElementById('acctClose');
  const acctGuestView = document.getElementById('acctGuestView');
  const acctUserView = document.getElementById('acctUserView');
  const acctLoginBtn = document.getElementById('acctLoginBtn');
  const acctSignupBtn = document.getElementById('acctSignupBtn');
  const acctLogoutBtn = document.getElementById('acctLogoutBtn');
  const accountBtnDesktop = document.getElementById('accountBtnDesktop');
  const accountBtnMobile = document.getElementById('accountBtnMobile');

  let isLoggedIn = loadJSON('mmbrother_account', false);

  function renderAcctState(){
    saveJSON('mmbrother_account', isLoggedIn);
    if (isLoggedIn){
      acctGuestView.style.display = 'none';
      acctUserView.style.display = 'flex';
    } else {
      acctGuestView.style.display = 'flex';
      acctUserView.style.display = 'none';
    }
  }

  function openAcctPanel(){
    renderAcctState();
    acctOverlay.classList.add('open');
    acctPanel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAcctPanel(){
    acctOverlay.classList.remove('open');
    acctPanel.classList.remove('open');
    document.body.style.overflow = '';
  }

  [accountBtnDesktop, accountBtnMobile].forEach(btn => {
    if (btn){
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openAcctPanel();
      });
    }
  });

  acctClose.addEventListener('click', closeAcctPanel);
  acctOverlay.addEventListener('click', closeAcctPanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && acctPanel.classList.contains('open')) closeAcctPanel();
  });

  [acctLoginBtn, acctSignupBtn].forEach(btn => {
    btn.addEventListener('click', () => {
      isLoggedIn = true;
      renderAcctState();
    });
  });

  acctLogoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLoggedIn = false;
    renderAcctState();
  });

/* ===== SIGNUP / NEWSLETTER FORM LOGIC ===== */
  const signupForm = document.getElementById('signupForm');
  const signupEmailInput = document.getElementById('signupEmail');
  const signupBtn = document.getElementById('signupBtn');
  const signupError = document.getElementById('signupError');
  const signupSuccess = document.getElementById('signupSuccess');

  function isValidEmail(value) {
    // Straightforward, practical email pattern
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function sendWelcomeEmail(email) {
    // Sends a welcome/confirmation email via EmailJS (client-side email delivery).
    // To activate real email delivery:
    //   1. Create a free account at https://www.emailjs.com/
    //   2. Add an Email Service (e.g. Gmail) and a Template with variables
    //      like {{to_email}} and {{message}}
    //   3. Replace the placeholders below with your Service ID, Template ID,
    //      and Public Key from the EmailJS dashboard.
    // Current EmailJS Gmail service
    const EMAILJS_SERVICE_ID = 'service_b5i3cab';
    const EMAILJS_TEMPLATE_ID = 'template_bdsji3f';
    const EMAILJS_PUBLIC_KEY = 'M_S8sMK5UUc2jbtPa';

    // EmailJS v4 requires the public key to be initialized before send().
    emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY
    });

    if (
      EMAILJS_SERVICE_ID === 'YOUR_EMAILJS_SERVICE_ID' ||
      typeof emailjs === 'undefined'
    ) {
      // EmailJS isn't configured yet — skip silently so the UI flow still works.
      return { skipped: true };
    }

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: email,
        email: email,
        subject: "You're in — Welcome to MM BROTHER",
        message:
          "You're now connected with MM BROTHER. You'll be the first to hear " +
          "about new drops, restocks, and exclusive releases."
      });
      return { sent: true };
    } catch (err) {
      console.error('Welcome email failed to send:', err);
      const status = err && err.status ? ` [${err.status}]` : '';
      const detail = err && (err.text || err.message) ? ` ${err.text || err.message}` : '';
      return { sent: false, error: `${status}${detail}`.trim() };
    }
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signupEmailInput.value;

      if (!isValidEmail(email)) {
        signupError.classList.add('show');
        signupEmailInput.focus();
        return;
      }

      signupError.classList.remove('show');
      signupBtn.disabled = true;
      signupBtn.textContent = 'JOINING...';

      const result = await sendWelcomeEmail(email);

      if (!result.sent) {
        signupBtn.disabled = false;
        signupBtn.textContent = 'JOIN MM BROTHER';
        signupError.textContent =
          'EmailJS error: ' + (result.error || 'Unknown error — check EmailJS History.');
        signupError.classList.remove('hide');
        signupError.classList.add('show');
        return;
      }

      signupForm.classList.add('hide');
      signupError.classList.add('hide');
      signupSuccess.classList.add('show');
    });

    signupEmailInput.addEventListener('input', () => {
      if (signupError.classList.contains('show')) {
        signupError.classList.remove('show');
      }
    });
  }

  /* ---- Initial paint: reflect whatever was already in storage (cart/wishlist
     badges, account state) immediately, not just after the next interaction. ---- */
  renderCartDrawer();
  renderWishlistDrawer();
  renderAcctState();

  /* ---- Re-sync on bfcache restore ----
     When the user navigates with the browser's Back/Forward buttons (or the
     site's own Close/logo-back links, which use history.back()), the browser
     often restores the page from its back-forward cache instead of reloading
     it — so the script above never runs again, and the cart/wishlist/account
     badges stay stuck showing whatever they were before the user left the
     page. 'pageshow' fires every time the page becomes visible, including on
     a bfcache restore (event.persisted is true then), so re-reading storage
     and re-rendering here keeps everything in sync no matter how the page
     was reached. */
  window.addEventListener('pageshow', () => {
    cartItems = loadJSON('mmbrother_cart', []);
    wishlistItems = loadJSON('mmbrother_wishlist', []);
    isLoggedIn = loadJSON('mmbrother_account', false);
    renderCartDrawer();
    renderWishlistDrawer();
    renderAcctState();
    scopedCards.forEach((card, idx) => {
      const heart = card.querySelector('.wishlist-btn');
      if (heart) heart.classList.toggle('active', wishlistItems.some(it => it.id === 'card-' + idx));
    });
  });
