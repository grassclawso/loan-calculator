"use strict";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const form = document.querySelector("#loan-form");
const fields = {
  principal: document.querySelector("#principal"),
  annualRate: document.querySelector("#annual-rate"),
  months: document.querySelector("#months"),
};
const commonTerm = document.querySelector("#common-term");
const results = {
  payment: document.querySelector("#monthly-payment"),
  interest: document.querySelector("#total-interest"),
  total: document.querySelector("#total-paid"),
  subtitle: document.querySelector("#results-subtitle"),
  status: document.querySelector("#results-status"),
  announcement: document.querySelector("#calculation-announcement"),
  count: document.querySelector("#schedule-count"),
  body: document.querySelector("#schedule-body"),
  empty: document.querySelector("#table-empty"),
};
const fieldErrors = {
  principal: { element: document.querySelector("#principal-error"), wrapper: document.querySelector("#principal-wrap") },
  annualRate: { element: document.querySelector("#rate-error"), wrapper: document.querySelector("#rate-wrap") },
  months: { element: document.querySelector("#months-error"), wrapper: document.querySelector("#months-wrap") },
};

const roundToCents = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
const formatCurrency = (amount) => currencyFormatter.format(amount);

function calculateMonthlyPayment(principal, annualRate, months) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return roundToCents(principal / months);

  const rateFactor = Math.pow(1 + monthlyRate, months);
  return roundToCents(principal * (monthlyRate * rateFactor) / (rateFactor - 1));
}

function generateAmortizationSchedule(principal, annualRate, months, monthlyPayment) {
  const monthlyRate = annualRate / 12 / 100;
  const schedule = [];
  let balance = roundToCents(principal);
  let totalInterest = 0;
  let totalPaid = 0;

  for (let month = 1; month <= months && balance > 0; month += 1) {
    const interest = roundToCents(balance * monthlyRate);
    const isLastMonth = month === months;
    const regularPrincipal = roundToCents(monthlyPayment - interest);
    const principalPaid = isLastMonth
      ? balance
      : Math.min(balance, regularPrincipal);
    const payment = isLastMonth
      ? roundToCents(interest + balance)
      : roundToCents(interest + principalPaid);
    balance = roundToCents(Math.max(0, balance - principalPaid));

    schedule.push({
      month,
      payment,
      interest,
      principal: principalPaid,
      balance,
    });
    totalInterest = roundToCents(totalInterest + interest);
    totalPaid = roundToCents(totalPaid + payment);
  }

  return { schedule, totalInterest, totalPaid };
}

const touchedFields = new Set();
let submitted = false;

function validateInputs() {
  const values = {
    principal: fields.principal.value.trim() === "" ? NaN : Number(fields.principal.value),
    annualRate: fields.annualRate.value.trim() === "" ? NaN : Number(fields.annualRate.value),
    months: fields.months.value.trim() === "" ? NaN : Number(fields.months.value),
  };
  if (Number.isFinite(values.principal)) values.principal = roundToCents(values.principal);
  const errors = {
    principal: !Number.isFinite(values.principal) || values.principal < 0.01
      ? "Enter a loan amount of at least $0.01."
      : "",
    annualRate: !Number.isFinite(values.annualRate) || values.annualRate < 0
      ? "Enter an interest rate of 0% or higher."
      : "",
    months: !Number.isInteger(values.months) || values.months <= 0
      ? "Enter a whole number of months greater than 0."
      : "",
  };

  Object.entries(errors).forEach(([name, message]) => {
    const { element, wrapper } = fieldErrors[name];
    const visibleError = message && (submitted || touchedFields.has(name)) ? message : "";
    element.textContent = visibleError;
    wrapper.setAttribute("aria-invalid", String(Boolean(visibleError)));
    fields[name].setAttribute("aria-invalid", String(Boolean(visibleError)));
  });

  return { valid: Object.values(errors).every((message) => !message), values };
}

function clearResults() {
  results.payment.textContent = "—";
  results.interest.textContent = "—";
  results.total.textContent = "—";
  results.subtitle.textContent = "Your estimate and payment schedule will appear here.";
  results.status.hidden = true;
  results.announcement.textContent = "";
  results.count.textContent = "Enter loan details to view each payment";
  results.body.replaceChildren();
  results.empty.hidden = false;
}

function renderSchedule(schedule) {
  const fragment = document.createDocumentFragment();
  schedule.forEach((row) => {
    const tr = document.createElement("tr");
    [row.month, formatCurrency(row.payment), formatCurrency(row.interest),
      formatCurrency(row.principal), formatCurrency(row.balance)].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      tr.append(cell);
    });
    fragment.append(tr);
  });

  results.body.replaceChildren(fragment);
  results.empty.hidden = true;
}

function calculateAndRender() {
  const { valid, values } = validateInputs();
  if (!valid) {
    clearResults();
    return false;
  }

  const payment = calculateMonthlyPayment(values.principal, values.annualRate, values.months);
  if (!Number.isFinite(payment) || payment <= 0) {
    clearResults();
    results.subtitle.textContent = "These values are outside the calculator's supported numeric range.";
    return false;
  }

  const { schedule, totalInterest, totalPaid } = generateAmortizationSchedule(
    values.principal,
    values.annualRate,
    values.months,
    payment,
  );
  if (!schedule.length || !Number.isFinite(totalInterest) || !Number.isFinite(totalPaid)) {
    clearResults();
    results.subtitle.textContent = "This loan could not be calculated. Check the values and try again.";
    return false;
  }

  results.payment.textContent = formatCurrency(payment);
  results.interest.textContent = formatCurrency(totalInterest);
  results.total.textContent = formatCurrency(totalPaid);
  results.subtitle.textContent = `${formatCurrency(values.principal)} at ${values.annualRate}% for ${values.months} months`;
  results.status.hidden = false;
  results.announcement.textContent = `Calculation complete. Monthly payment ${formatCurrency(payment)}. Total interest ${formatCurrency(totalInterest)}. Total paid ${formatCurrency(totalPaid)}.`;
  results.count.textContent = `${schedule.length.toLocaleString("en-US")} monthly payments`;
  renderSchedule(schedule);
  return true;
}

let recalculationTimer;
Object.values(fields).forEach((field) => {
  field.addEventListener("input", () => {
    touchedFields.add(field.name);
    if (field.name === "months") commonTerm.value = "";
    window.clearTimeout(recalculationTimer);
    recalculationTimer = window.setTimeout(calculateAndRender, 200);
  });
  field.addEventListener("blur", () => {
    touchedFields.add(field.name);
    validateInputs();
  });
});

commonTerm.addEventListener("change", () => {
  if (!commonTerm.value) return;
  fields.months.value = commonTerm.value;
  calculateAndRender();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitted = true;
  if (!calculateAndRender()) {
    const firstInvalid = Object.values(fields).find((field) => field.getAttribute("aria-invalid") === "true");
    firstInvalid?.focus();
  }
});

form.addEventListener("reset", () => {
  window.clearTimeout(recalculationTimer);
  window.setTimeout(() => {
    submitted = false;
    touchedFields.clear();
    Object.values(fieldErrors).forEach(({ element, wrapper }) => {
      element.textContent = "";
      wrapper.setAttribute("aria-invalid", "false");
    });
    Object.values(fields).forEach((field) => field.setAttribute("aria-invalid", "false"));
    commonTerm.value = "";
    clearResults();
  }, 0);
});
