/* LoanCheck — vanilla JS application controller. No sensitive identifiers are collected. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
  const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const money = (value) => currency.format(Math.max(0, Math.round(Number(value) || 0))).replace('₹', '₹ ');
  const digits = (value) => number.format(Math.max(0, Math.round(Number(value) || 0)));
  const annualRates = { personal: 12.5, home: 8.75, car: 9.5, education: 10.25 };
  const rateRanges = { personal: '11.5% – 18.5%', home: '8.5% – 11.5%', car: '8.75% – 14.5%', education: '9% – 13.5%' };
  const APP_CONFIG = { sheetsEndpoint: '' };
  let latestContext = {};

  function calculateEMI(principal, annualRate, months) {
    const p = Number(principal) || 0;
    const n = Number(months) || 0;
    const monthlyRate = (Number(annualRate) || 0) / 1200;
    if (!p || !n) return 0;
    if (!monthlyRate) return p / n;
    const factor = Math.pow(1 + monthlyRate, n);
    return p * monthlyRate * factor / (factor - 1);
  }

  function showToast(message, tone = 'success') {
    const region = $('#toast-region');
    if (!region) return;
    const icon = tone === 'error' ? 'alert-circle' : tone === 'warning' ? 'triangle-alert' : 'check-circle-2';
    const toast = document.createElement('div');
    toast.className = `toast ${tone}`;
    toast.innerHTML = `<i data-lucide="${icon}"></i><p>${escapeHtml(message)}</p>`;
    region.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    window.setTimeout(() => toast.remove(), 4600);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function initNavigation() {
    const toggle = $('#menu-toggle');
    const nav = $('#primary-nav');
    toggle?.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      toggle.innerHTML = `<i data-lucide="${open ? 'x' : 'menu'}"></i>`;
      window.lucide?.createIcons();
    });
    $$('.primary-nav a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.setAttribute('aria-label', 'Open navigation');
      if (toggle) toggle.innerHTML = '<i data-lucide="menu"></i>';
      window.lucide?.createIcons();
    }));
    const sections = $$('main section[id]');
    const links = $$('.nav-link');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    }), { rootMargin: '-35% 0px -55% 0px' });
    sections.forEach((section) => observer.observe(section));
  }

  function initReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach((item) => item.classList.add('visible')); return; }
    const observer = new IntersectionObserver((entries, obs) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); obs.unobserve(entry.target); }
    }), { threshold: 0.08 });
    items.forEach((item) => observer.observe(item));
  }

  function setError(id, message) {
    const input = $(`#${id}`);
    const error = $(`#${id}-error`);
    input?.classList.toggle('invalid', Boolean(message));
    if (error) error.textContent = message || '';
  }

  function readEligibilityForm() {
    const form = $('#eligibility-form');
    const data = new FormData(form);
    return {
      fullName: String(data.get('fullName') || '').trim(), email: String(data.get('email') || '').trim(), phone: String(data.get('phone') || '').replace(/\D/g, ''),
      age: Number(data.get('age')), employment: String(data.get('employment') || ''), income: Number(data.get('income')), experience: Number(data.get('experience')),
      creditScore: Number(data.get('creditScore')), existingEmi: Number(data.get('existingEmi')), activeLoans: Number(data.get('activeLoans')),
      loanType: String(data.get('loanType') || ''), loanAmount: Number(data.get('loanAmount')), tenure: Number(data.get('tenure')), consent: $('#consent')?.checked === true
    };
  }

  function validateEligibility(data) {
    const errors = {};
    if (data.fullName.length < 2) errors.fullName = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Enter a valid email address.';
    if (!/^[6-9]\d{9}$/.test(data.phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (!Number.isFinite(data.age) || data.age < 21 || data.age > 60) errors.age = 'Age must be between 21 and 60.';
    if (!['salaried', 'self-employed', 'business'].includes(data.employment)) errors.employment = 'Choose an employment type.';
    if (!Number.isFinite(data.income) || data.income <= 0) errors.income = 'Monthly income must be greater than ₹ 0.';
    if (!Number.isFinite(data.experience) || data.experience < 0 || data.experience > 45) errors.experience = 'Enter work experience from 0 to 45 years.';
    if (!Number.isFinite(data.creditScore) || data.creditScore < 300 || data.creditScore > 900) errors['credit-input'] = 'Credit score must be between 300 and 900.';
    if (!Number.isFinite(data.existingEmi) || data.existingEmi < 0) errors.existingEmi = 'Enter 0 if you have no existing EMIs.';
    if (!Number.isFinite(data.activeLoans) || data.activeLoans < 0 || data.activeLoans > 20) errors.activeLoans = 'Enter a number from 0 to 20.';
    if (!['personal', 'home', 'car', 'education'].includes(data.loanType)) errors.loanType = 'Choose a loan type.';
    if (!Number.isFinite(data.loanAmount) || data.loanAmount < 10000 || data.loanAmount > 100000000) errors.loanAmount = 'Enter an amount between ₹ 10,000 and ₹ 10 crore.';
    if (!Number.isFinite(data.tenure) || data.tenure < 6 || data.tenure > 360) errors.tenure = 'Tenure must be between 6 and 360 months.';
    const minIncome = data.employment === 'salaried' ? 15000 : 25000;
    if (!errors.income && !errors.employment && data.income < minIncome) errors.income = `Estimated minimum for this profile is ${money(minIncome)} per month.`;
    if (!errors.age && !errors.tenure && data.age + data.tenure / 12 > 65) errors.tenure = 'Loan maturity must be at or before age 65.';
    if (!data.consent) errors.consent = 'Please confirm the estimate is for educational use.';
    Object.entries({ ...errors, consent: errors.consent }).forEach(([id, message]) => {
      if (id === 'consent') { const error = $('#consent-error'); if (error) error.textContent = message || ''; return; }
      const idMap = { fullName: 'full-name', creditInput: 'credit-input', existingEmi: 'existing-emi', activeLoans: 'active-loans', loanType: 'loan-type', loanAmount: 'loan-amount' };
      setError(idMap[id] || id, message);
    });
    const fieldIds = [['fullName', 'full-name'], ['email', 'email'], ['phone', 'phone'], ['age', 'age'], ['employment', 'employment'], ['income', 'income'], ['experience', 'experience'], ['credit-input', 'credit-input'], ['existingEmi', 'existing-emi'], ['activeLoans', 'active-loans'], ['loanType', 'loan-type'], ['loanAmount', 'loan-amount'], ['tenure', 'tenure']];
    fieldIds.forEach(([key, id]) => setError(id, errors[key] || ''));
    return errors;
  }

  function scoreEligibility(data) {
    const annualRate = annualRates[data.loanType] || 12.5;
    const newEmi = calculateEMI(data.loanAmount, annualRate, data.tenure);
    const foir = (data.existingEmi + newEmi) / data.income;
    const creditComponent = clamp((data.creditScore - 300) / 6, 0, 100);
    const foirComponent = foir <= 0.5 ? 100 : clamp(100 - ((foir - 0.5) / 0.5) * 100, 0, 100);
    const employmentBase = data.employment === 'salaried' ? 100 : data.employment === 'self-employed' ? 88 : 82;
    const stabilityComponent = clamp(employmentBase * (data.experience >= 2 ? 1 : 0.76), 0, 100);
    const ageComponent = data.age >= 28 && data.age <= 45 ? 100 : data.age <= 55 ? 82 : 60;
    const obligationsComponent = clamp(100 - data.activeLoans * 18 - (data.existingEmi / data.income) * 65, 5, 100);
    const score = Math.round(creditComponent * .35 + foirComponent * .30 + stabilityComponent * .15 + ageComponent * .10 + obligationsComponent * .10);
    const verdict = score >= 75 && foir <= 0.5 && data.creditScore >= 650 ? 'Highly Eligible' : score >= 50 && foir <= 0.5 && data.creditScore >= 600 ? 'Moderately Eligible' : 'Not Eligible';
    const capacity = Math.max(0, data.income * 0.5 - data.existingEmi);
    const monthlyRate = annualRate / 1200;
    const maxAmount = monthlyRate ? capacity * (1 - Math.pow(1 + monthlyRate, -data.tenure)) / monthlyRate : capacity * data.tenure;
    const probability = clamp(Math.round(score * 0.86 + (data.creditScore >= 650 ? 8 : -8) + (foir <= .5 ? 7 : -22)), 8, 96);
    const reasons = [];
    const suggestions = [];
    if (data.creditScore >= 750) reasons.push('Your credit score is in a strong range.'); else if (data.creditScore < 650) { reasons.push('A score below 650 can make approval and pricing harder.'); suggestions.push('Prioritize every payment due date and keep card usage below 30%.'); } else reasons.push('Your credit score is workable, with room to strengthen it.');
    if (foir <= .5) reasons.push(`Your estimated FOIR is ${Math.round(foir * 100)}%, within the 50% comfort rule.`); else { reasons.push(`Estimated FOIR is ${Math.round(foir * 100)}%, above the 50% comfort rule.`); suggestions.push('Reduce existing EMIs or choose a smaller loan amount before applying.'); }
    if (data.experience >= 2) reasons.push('Your work experience supports a stable income profile.'); else suggestions.push('A longer, consistent work history can improve lender confidence.');
    if (data.activeLoans > 1) suggestions.push('Consider closing a small outstanding balance before taking on a new EMI.');
    if (data.age + data.tenure / 12 > 60) suggestions.push('A shorter tenure may keep the loan comfortably within maturity guidelines.');
    if (!suggestions.length) suggestions.push('Compare at least two lender offers and keep an emergency buffer before committing.');
    return { ...data, annualRate, newEmi, foir, score, verdict, probability, maxAmount: Math.max(0, maxAmount), rateRange: rateRanges[data.loanType] || 'Varies by lender', reasons, suggestions };
  }

  function renderEligibility(result) {
    const card = $('#eligibility-result');
    const tone = result.verdict === 'Highly Eligible' ? 'high' : result.verdict === 'Moderately Eligible' ? 'medium' : 'low';
    const summary = result.verdict === 'Highly Eligible' ? 'Your profile looks well-positioned for the request you entered.' : result.verdict === 'Moderately Eligible' ? 'You may qualify, but lender pricing and documentation will matter.' : 'This request may need a smaller amount, lower obligations, or a stronger credit profile.';
    card.innerHTML = `<div class="result-summary-top"><div><span class="section-kicker">Your eligibility snapshot</span><div class="result-verdict">${escapeHtml(result.verdict)}</div><p class="result-summary">${escapeHtml(summary)}</p></div><span class="verdict-badge ${tone}"><i data-lucide="${tone === 'low' ? 'circle-alert' : 'badge-check'}"></i>${escapeHtml(result.verdict)}</span></div><div class="result-score"><div class="result-gauge" style="--gauge-angle:${result.score * 3.6}deg"><div><strong>${result.score}</strong><small>/100</small></div></div><div><span class="muted-label">Estimated approval probability</span><div class="score-number"><strong>${result.probability}%</strong></div><p class="result-summary">Based on the details and assumptions you entered.</p></div></div><div class="result-metrics"><div><span>Max. eligible</span><strong>${money(result.maxAmount)}</strong></div><div><span>Est. EMI</span><strong>${money(result.newEmi)}</strong></div><div><span>Rate range</span><strong>${escapeHtml(result.rateRange)}</strong></div></div><div class="result-lists"><div><h4>Why this score</h4><ul>${result.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div><h4>Improve next</h4><ul>${result.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div><div class="result-explanation"><h4><i data-lucide="sparkles"></i> Plain-English explanation</h4><p id="eligibility-explanation">Preparing a concise explanation…</p></div>`;
    window.lucide?.createIcons();
    latestContext = { eligibility: result };
    requestAI('eligibility', buildEligibilityPrompt(result)).then((text) => { const target = $('#eligibility-explanation'); if (target) target.textContent = text; });
  }

  function buildEligibilityPrompt(result) {
    return `A user entered an estimated ${result.loanType} loan request. Profile: age ${result.age}, ${result.employment}, monthly income ${money(result.income)}, credit score ${result.creditScore}, existing EMIs ${money(result.existingEmi)}, active loans ${result.activeLoans}, requested ${money(result.loanAmount)} for ${result.tenure} months. Calculated score ${result.score}/100, verdict ${result.verdict}, estimated FOIR ${Math.round(result.foir * 100)}%, estimated EMI ${money(result.newEmi)}. Explain the decision in 2 short plain-English sentences, mention the strongest factor and one practical caution. Add “Not financial advice.”`;
  }

  async function requestAI(mode, prompt) {
    const fallback = mode === 'eligibility' ? 'Your estimate balances credit profile, income-to-EMI comfort, stability, age, and existing obligations. Use the strongest factor as a base, then work on the biggest caution before you apply. Not financial advice.' : 'A practical next step is to keep every payment on time, keep revolving credit below 30% where possible, and compare the total repayment cost — not only the monthly EMI. Not financial advice.';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch('/api/ai-tips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, prompt, context: latestContext }), signal: controller.signal });
      if (!response.ok) throw new Error('AI unavailable');
      const payload = await response.json();
      return payload.text || fallback;
    } catch (error) {
      return fallback;
    } finally { window.clearTimeout(timer); }
  }

  function initEligibility() {
    const form = $('#eligibility-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = readEligibilityForm();
      const errors = validateEligibility(data);
      if (Object.keys(errors).length) { showToast('Please review the highlighted fields.', 'warning'); $('.invalid', form)?.focus(); return; }
      const result = scoreEligibility(data);
      renderEligibility(result);
      await persistCheck(result);
      $('#eligibility-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $$('input,select', form || document).forEach((input) => input.addEventListener('input', () => {
      if (input.classList.contains('invalid')) { const fieldId = input.id; setError(fieldId, ''); }
    }));
    $('#refresh-checks')?.addEventListener('click', loadRecentChecks);
    loadRecentChecks();
  }

  function getSheetsEndpoint() { return APP_CONFIG.sheetsEndpoint || localStorage.getItem('loancheckSheetsEndpoint') || ''; }
  function recentStorage() { try { return JSON.parse(localStorage.getItem('loancheckRecentChecks') || '[]'); } catch { return []; } }
  function setRecentStorage(items) { localStorage.setItem('loancheckRecentChecks', JSON.stringify(items.slice(0, 6))); }
  async function persistCheck(result) {
    const record = { name: result.fullName, email: result.email, phone: result.phone, income: result.income, creditScore: result.creditScore, loanType: result.loanType, requestedAmount: result.loanAmount, eligibilityScore: result.score, verdict: result.verdict, timestamp: new Date().toISOString() };
    const endpoint = getSheetsEndpoint();
    let savedRemotely = false;
    if (endpoint) {
      try {
        const response = await fetch(endpoint, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(record) });
        const payload = await response.json();
        if (!response.ok || payload.ok !== true) throw new Error('Save failed');
        savedRemotely = true;
        showToast('Saved securely to your connected Google Sheet.');
      } catch { showToast('Could not reach Google Sheets. The check remains saved in this browser.', 'warning'); }
    } else showToast('Check saved in this browser. Connect Sheets when you are ready.', 'success');
    setRecentStorage([record, ...recentStorage().filter((item) => item.timestamp !== record.timestamp)]);
    if (savedRemotely) await loadRecentChecks(); else renderRecentChecks(recentStorage());
  }
  async function loadRecentChecks() {
    const endpoint = getSheetsEndpoint();
    if (endpoint) { try { const response = await fetch(endpoint, { mode: 'cors' }); const payload = await response.json(); if (Array.isArray(payload.records)) { renderRecentChecks(payload.records); return; } } catch { /* local fallback below */ } }
    renderRecentChecks(recentStorage());
  }
  function renderRecentChecks(records) {
    const body = $('#recent-checks-body');
    if (!body) return;
    if (!records.length) { body.innerHTML = '<tr class="table-empty"><td colspan="4">No checks yet — your first one will show here.</td></tr>'; return; }
    body.innerHTML = records.slice(0, 6).map((record) => `<tr><td>${new Date(record.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td><td>${escapeHtml(String(record.loanType || '').replace(/^./, (char) => char.toUpperCase()))}</td><td>${escapeHtml(record.eligibilityScore ?? '—')}</td><td><span class="table-verdict">${escapeHtml(record.verdict || 'Saved')}</span></td></tr>`).join('');
  }

  function initCreditAnalyzer() {
    const form = $('#credit-form');
    const ranges = [['#payment-history', '#payment-history-output', '%'], ['#utilization', '#utilization-output', '%']];
    ranges.forEach(([input, output, suffix]) => $(input)?.addEventListener('input', (event) => { $(output).textContent = `${event.target.value}${suffix}`; analyzeCredit(); }));
    $$('input', form || document).forEach((input) => input.addEventListener('input', analyzeCredit));
    form?.addEventListener('submit', (event) => { event.preventDefault(); analyzeCredit(); showToast('Credit factors updated.'); });
    analyzeCredit();
  }
  function analyzeCredit() {
    const payment = clamp($('#payment-history')?.value, 0, 100);
    const utilization = clamp($('#utilization')?.value, 0, 100);
    const age = clamp($('#credit-age')?.value, 0, 40);
    const types = clamp($('#credit-types')?.value, 0, 8);
    const inquiries = clamp($('#inquiries')?.value, 0, 20);
    const missed = clamp($('#missed-payments')?.value, 0, 20);
    const factors = { payment, utilization: clamp(100 - utilization, 0, 100), age: clamp(age / 10 * 100, 0, 100), mix: clamp(types / 4 * 100, 0, 100), inquiries: clamp(100 - inquiries * 8, 0, 100), missed: clamp(100 - missed * 16, 0, 100) };
    const score = Math.round(300 + (factors.payment * .35 + factors.utilization * .2 + factors.age * .15 + factors.mix * .1 + factors.inquiries * .1 + factors.missed * .1) * 6);
    const band = score >= 750 ? 'Excellent' : score >= 700 ? 'Good' : score >= 600 ? 'Fair' : 'Poor';
    const risk = score >= 750 ? 'Low risk' : score >= 650 ? 'Medium risk' : 'High risk';
    const badgeTone = risk.startsWith('Low') ? 'low' : risk.startsWith('Medium') ? 'medium' : 'high';
    $('#credit-score-number').textContent = score;
    $('#credit-band-label').textContent = `${band} range`;
    const badge = $('#risk-badge'); badge.textContent = risk; badge.className = `risk-badge ${badgeTone}`;
    const markerAngle = -90 + ((score - 300) / 600) * 180;
    $('#meter-marker')?.style.setProperty('--marker-angle', `${markerAngle}deg`);
    setFactor('payment', factors.payment); setFactor('utilization', factors.utilization); setFactor('age', factors.age); setFactor('mix', factors.mix); setFactor('inquiries', factors.inquiries); setFactor('missed', factors.missed);
    const tips = [];
    if (utilization > 30) tips.push('Bring revolving utilization below 30% before a major loan application.');
    if (payment < 95 || missed > 0) tips.push('Set autopay or reminders so every payment arrives before its due date.');
    if (age < 5) tips.push('Keep older, healthy accounts open when practical to build credit age.');
    if (inquiries > 2) tips.push('Space out new applications and compare offers without multiple hard inquiries.');
    if (types < 2) tips.push('A balanced mix can help over time, but do not borrow just to add an account.');
    if (!tips.length) tips.push('Keep your current habits steady and review your bureau report for errors once a year.');
    if (tips.length < 4) tips.push('Review your credit report once a year and dispute any unfamiliar entries.');
    if (tips.length < 4) tips.push('Keep a small emergency buffer so one surprise expense does not become a missed payment.');
    if (tips.length < 4) tips.push('Compare the total cost of borrowing before opening another account.');
    $('#credit-tips').innerHTML = tips.slice(0, 5).map((tip) => `<li>${escapeHtml(tip)}</li>`).join('');
    latestContext.credit = { score, band, risk, utilization, payment, age, types, inquiries, missed };
  }
  function setFactor(name, value) { const bar = $(`#factor-${name}`); const output = $(`#factor-${name}-value`); if (bar) bar.style.width = `${clamp(value, 0, 100)}%`; if (output) output.textContent = `${Math.round(value)}%`; }

  function initEmiCalculator() {
    const pairs = [['#emi-amount-range', '#emi-amount-input'], ['#emi-rate-range', '#emi-rate-input'], ['#emi-tenure-range', '#emi-tenure-input']];
    pairs.forEach(([rangeSelector, inputSelector, outputSelector]) => {
      const range = $(rangeSelector); const input = $(inputSelector); if (!range) return;
      range.addEventListener('input', () => { if (input && input !== range) input.value = range.value; calculateEmiView(); });
      if (input && input !== range) input.addEventListener('input', () => { range.value = input.value; calculateEmiView(); });
    });
    $$('[data-tenure-unit]').forEach((button) => button.addEventListener('click', () => setTenureUnit(button.dataset.tenureUnit)));
    $('#schedule-toggle')?.addEventListener('click', () => { const content = $('#schedule-content'); const expanded = $('#schedule-toggle').getAttribute('aria-expanded') === 'true'; $('#schedule-toggle').setAttribute('aria-expanded', String(!expanded)); content.hidden = expanded; });
    calculateEmiView();
  }
  function setTenureUnit(unit) {
    const range = $('#emi-tenure-range'); const input = $('#emi-tenure-input'); const currentUnit = $('[data-tenure-unit].active')?.dataset.tenureUnit || 'months';
    const currentValue = Number(range?.value) || 60; const currentMonths = currentUnit === 'years' ? currentValue * 12 : currentValue; const isYears = unit === 'years';
    $$('[data-tenure-unit]').forEach((item) => item.classList.toggle('active', item.dataset.tenureUnit === unit));
    if (range) { range.min = isYears ? '1' : '6'; range.max = isYears ? '30' : '360'; range.step = isYears ? '1' : '6'; range.value = String(isYears ? Math.max(1, Math.round(currentMonths / 12)) : currentMonths); }
    if (input) { input.min = isYears ? '1' : '6'; input.max = isYears ? '30' : '360'; input.step = isYears ? '1' : '6'; input.value = range?.value || '60'; }
    const unitLabel = $('#emi-tenure-unit-label'); if (unitLabel) unitLabel.textContent = isYears ? 'years' : 'months';
    calculateEmiView();
  }
  function calculateEmiView() {
    const principal = clamp($('#emi-amount-range')?.value, 100000, 5000000); const rate = clamp($('#emi-rate-range')?.value, 6, 24); const activeUnit = $('[data-tenure-unit].active')?.dataset.tenureUnit || 'months'; const tenureValue = Number($('#emi-tenure-range')?.value) || 60; const months = activeUnit === 'years' ? tenureValue * 12 : tenureValue; const emi = calculateEMI(principal, rate, months); const total = emi * months; const interest = total - principal; const yearsActive = activeUnit === 'years';
    $('#emi-amount-output').textContent = money(principal); $('#emi-rate-output').textContent = `${rate.toFixed(2)}%`; $('#emi-tenure-output').textContent = yearsActive ? `${(months / 12).toFixed(1)} years` : `${months} months`; $('#emi-value').textContent = money(emi); $('#total-interest').textContent = money(interest); $('#total-payable').textContent = money(total); $('#principal-percent').textContent = `${Math.round(principal / total * 100)}%`; $('#principal-legend').textContent = money(principal); $('#interest-legend').textContent = money(interest); drawDonut(principal, interest); renderSchedule(principal, rate, months, emi); latestContext.emi = { principal, rate, months, emi, interest, total };
  }
  function drawDonut(principal, interest) { const canvas = $('#emi-donut'); if (!canvas) return; const ctx = canvas.getContext('2d'); const ratio = principal / Math.max(1, principal + interest); const center = canvas.width / 2; const radius = 72; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.lineWidth = 26; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.strokeStyle = '#22D3EE'; ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = '#8B5CF6'; ctx.arc(center, center, radius, -Math.PI / 2 + Math.PI * 2 * ratio, -Math.PI / 2 + Math.PI * 2); ctx.stroke(); }
  function renderSchedule(principal, rate, months, emi) { const body = $('#schedule-body'); if (!body) return; let balance = principal; const monthlyRate = rate / 1200; const rows = []; for (let month = 1; month <= months; month += 1) { const interest = monthlyRate ? balance * monthlyRate : 0; const paidPrincipal = Math.min(balance, emi - interest); balance = Math.max(0, balance - paidPrincipal); rows.push(`<tr><td>${month}</td><td>${money(emi)}</td><td>${money(paidPrincipal)}</td><td>${money(interest)}</td><td>${money(balance)}</td></tr>`); } body.innerHTML = rows.join(''); }

  function initChat() {
    const form = $('#chat-form'); const input = $('#chat-input');
    $$('.quick-prompts button').forEach((button) => button.addEventListener('click', () => { input.value = button.dataset.prompt; form.requestSubmit(); }));
    form?.addEventListener('submit', async (event) => { event.preventDefault(); const prompt = input.value.trim(); if (!prompt) return; appendMessage('user', prompt); input.value = ''; const typing = appendTyping(); const response = await requestAI('chat', `${prompt}\nUse this context if relevant: ${JSON.stringify(latestContext)}\nAnswer in 3–5 concise, practical bullets or short paragraphs. Add “Not financial advice.”`); typing.remove(); appendMessage('assistant', response); });
  }
  function appendMessage(role, text) { const history = $('#chat-history'); const wrapper = document.createElement('div'); wrapper.className = `chat-message ${role}`; wrapper.innerHTML = `<div class="message-avatar"><i data-lucide="${role === 'assistant' ? 'sparkles' : 'user-round'}"></i></div><div class="message-bubble"><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>${role === 'assistant' ? '<small>Not financial advice · Estimates are educational</small>' : ''}</div>`; history.appendChild(wrapper); history.scrollTop = history.scrollHeight; window.lucide?.createIcons(); return wrapper; }
  function appendTyping() { const history = $('#chat-history'); const wrapper = document.createElement('div'); wrapper.className = 'chat-message assistant'; wrapper.innerHTML = '<div class="message-avatar"><i data-lucide="sparkles"></i></div><div class="message-bubble"><div class="typing-dots" aria-label="Assistant is typing"><i></i><i></i><i></i></div></div>'; history.appendChild(wrapper); history.scrollTop = history.scrollHeight; window.lucide?.createIcons(); return wrapper; }

  function initYear() { const year = $('#year'); if (year) year.textContent = new Date().getFullYear(); }
  function initIcons() { window.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } }); }

  window.LoanCheck = { calculateEMI, scoreEligibility };
  document.addEventListener('DOMContentLoaded', () => { initNavigation(); initReveal(); initEligibility(); initCreditAnalyzer(); initEmiCalculator(); initChat(); initYear(); initIcons(); });
})();
