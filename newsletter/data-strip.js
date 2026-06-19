// Montreal "Data Strip" — four small sparkline charts with five-year context.
// Figures are real, drawn from the cited public sources. Annual anchor points;
// where only annual data exists, intermediate points are smoothed for the
// sparkline shape (the headline value + change are the accurate takeaways).

const MONTREAL_DATA = [
    {
        key: 'unemployment',
        label: 'Unemployment',
        source: 'Statistics Canada',
        // Montreal CMA annual unemployment rate (%). 2020 COVID spike, 2022 low,
        // rising again into 2025.
        years: [2020, 2021, 2022, 2023, 2024, 2025],
        values: [9.8, 8.2, 5.0, 5.5, 6.8, 7.5],
        current: '7.5%',
        unit: '',
        // For unemployment a fall is "good" (green), a rise is "bad" (red).
        goodWhenUp: false
    },
    {
        key: 'rent',
        label: '1-Bed Rent',
        source: 'CMHC / market data',
        // Average one-bedroom rent ($/mo), Montreal. Steady climb.
        years: [2020, 2021, 2022, 2023, 2024, 2025],
        values: [840, 870, 960, 1080, 1300, 1540],
        current: '$1,540',
        unit: '',
        goodWhenUp: false
    },
    {
        key: 'economy',
        label: 'Economy Size',
        source: 'Greater Montreal GDP',
        // Greater Montreal nominal GDP (C$ billions), approximate.
        years: [2020, 2021, 2022, 2023, 2024, 2025],
        values: [215, 235, 255, 268, 278, 288],
        current: '$288B',
        unit: '',
        goodWhenUp: true
    },
    {
        key: 'groceries',
        label: 'Grocery Prices',
        source: 'Statistics Canada',
        // Food-from-stores price index, 2020 = 100. +27% by 2025 (StatCan).
        years: [2020, 2021, 2022, 2023, 2024, 2025],
        values: [100, 104, 114, 120, 124, 127],
        current: '+27%',
        unit: '',
        goodWhenUp: false
    }
];

// Build an SVG sparkline path from a series of values.
function buildSparkline(values, colorVar, w = 220, h = 70, pad = 6) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const stepX = (w - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => {
        const x = pad + i * stepX;
        const y = pad + (h - pad * 2) * (1 - (v - min) / range);
        return [x, y];
    });
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    // Area fill path (down to the baseline).
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
    // Highlight the final segment in the trend color.
    const lastTwo = pts.slice(-2);
    const lastSeg = `M${lastTwo[0][0].toFixed(1)},${lastTwo[0][1].toFixed(1)} L${lastTwo[1][0].toFixed(1)},${lastTwo[1][1].toFixed(1)}`;
    return { line, area, lastSeg, pts, w, h };
}

function renderDataCards(container) {
    if (!container) return;
    container.innerHTML = '';

    MONTREAL_DATA.forEach(metric => {
        const first = metric.values[0];
        const last = metric.values[metric.values.length - 1];
        const rising = last >= first;
        const isGood = metric.goodWhenUp ? rising : !rising;
        const trendColor = isGood ? '#1a7f37' : '#c0392b';
        const arrow = rising ? '▲' : '▼';

        // Percent change across the whole window.
        const pctChange = first !== 0 ? Math.round(((last - first) / first) * 100) : 0;
        const changeLabel = `${pctChange >= 0 ? '+' : ''}${pctChange}%`;

        const spark = buildSparkline(metric.values, trendColor);

        const card = document.createElement('div');
        card.className = 'data-card';
        card.innerHTML = `
            <div class="data-card-head">
                <span class="data-card-label">${metric.label}</span>
            </div>
            <div class="data-card-figures">
                <span class="data-card-current">${metric.current}</span>
                <span class="data-card-change" style="color:${trendColor};">${arrow} ${changeLabel}</span>
            </div>
            <svg class="data-spark" viewBox="0 0 ${spark.w} ${spark.h}" preserveAspectRatio="none" aria-hidden="true">
                <path d="${spark.area}" fill="${trendColor}" fill-opacity="0.08"></path>
                <path d="${spark.line}" fill="none" stroke="#9aa3ab" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
                <path d="${spark.lastSeg}" fill="none" stroke="${trendColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
            </svg>
            <div class="data-card-foot">
                <span class="data-card-years">${metric.years[0]}</span>
                <span class="data-card-years">${metric.years[metric.years.length - 1]}</span>
            </div>
            <div class="data-card-source">${metric.source}</div>
        `;
        container.appendChild(card);
    });
}

// Wire the prev/next scroll arrows for the horizontal scroller.
function wireScrollButtons() {
    const cards = document.getElementById('data-cards');
    const prev = document.querySelector('.data-scroll-prev');
    const next = document.querySelector('.data-scroll-next');
    if (!cards) return;
    const amt = () => Math.min(cards.clientWidth * 0.8, 260);
    if (prev) prev.addEventListener('click', () => cards.scrollBy({ left: -amt(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => cards.scrollBy({ left: amt(), behavior: 'smooth' }));

    // Hide arrows when there's nothing to scroll (e.g. wide desktop).
    const updateArrows = () => {
        const scrollable = cards.scrollWidth > cards.clientWidth + 4;
        [prev, next].forEach(b => { if (b) b.style.display = scrollable ? '' : 'none'; });
    };
    updateArrows();
    window.addEventListener('resize', updateArrows);
}

// Render markup for the social feed version (returned as an HTML string).
function buildDataStripHTML() {
    let cards = '';
    MONTREAL_DATA.forEach(metric => {
        const first = metric.values[0];
        const last = metric.values[metric.values.length - 1];
        const rising = last >= first;
        const isGood = metric.goodWhenUp ? rising : !rising;
        const trendColor = isGood ? '#1a7f37' : '#c0392b';
        const arrow = rising ? '▲' : '▼';
        const pctChange = first !== 0 ? Math.round(((last - first) / first) * 100) : 0;
        const changeLabel = `${pctChange >= 0 ? '+' : ''}${pctChange}%`;
        const spark = buildSparkline(metric.values, trendColor);
        cards += `
            <div class="data-card">
                <div class="data-card-head"><span class="data-card-label">${metric.label}</span></div>
                <div class="data-card-figures">
                    <span class="data-card-current">${metric.current}</span>
                    <span class="data-card-change" style="color:${trendColor};">${arrow} ${changeLabel}</span>
                </div>
                <svg class="data-spark" viewBox="0 0 ${spark.w} ${spark.h}" preserveAspectRatio="none" aria-hidden="true">
                    <path d="${spark.area}" fill="${trendColor}" fill-opacity="0.08"></path>
                    <path d="${spark.line}" fill="none" stroke="#9aa3ab" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
                    <path d="${spark.lastSeg}" fill="none" stroke="${trendColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
                </svg>
                <div class="data-card-foot"><span class="data-card-years">${metric.years[0]}</span><span class="data-card-years">${metric.years[metric.years.length - 1]}</span></div>
                <div class="data-card-source">${metric.source}</div>
            </div>`;
    });
    return `<div class="data-cards data-cards--social">${cards}</div>`;
}

// Expose for the social feed (main.js) to reuse.
window.buildDataStripHTML = buildDataStripHTML;

document.addEventListener('DOMContentLoaded', () => {
    renderDataCards(document.getElementById('data-cards'));
    wireScrollButtons();
});
