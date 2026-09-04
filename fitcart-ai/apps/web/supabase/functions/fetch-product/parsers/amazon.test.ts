// Exercises amazon.ts's parser against realistic captured-shape HTML
// fixtures built to mirror the real structure observed this session (7 real
// Amazon product pages fetched manually via curl + a browser User-Agent) —
// never a live network call. Covers: full extraction success (name, price,
// deduped gallery, size chart, description, material), and the honest
// null/[] fallbacks for each richer field when its own marker is
// missing/unparseable, plus the original name/price extraction the parser
// already did before this session's extension.

import { assert, assertEquals } from '../../search-products/_testUtils.ts';
import { parse } from './amazon.ts';

const GALLERY_SCRIPT = `
<script type="text/javascript">
  var data = {
    "colorImages": { "initial": [
      {"hiRes":"https://m.media-amazon.com/images/I/71ABCDeqXL._SL1500_.jpg","thumb":"https://m.media-amazon.com/images/I/71ABCDeqXL._SS40_.jpg","large":"https://m.media-amazon.com/images/I/71ABCDeqXL.jpg"},
      {"hiRes":"https://m.media-amazon.com/images/I/81WXYZfghL._SL1500_.jpg","thumb":"https://m.media-amazon.com/images/I/81WXYZfghL._SS40_.jpg","large":"https://m.media-amazon.com/images/I/81WXYZfghL.jpg"},
      {"hiRes":"https://m.media-amazon.com/images/I/71ABCDeqXL._SL1500_.jpg","thumb":"https://m.media-amazon.com/images/I/71ABCDeqXL._SS40_.jpg","large":"https://m.media-amazon.com/images/I/71ABCDeqXL.jpg"}
    ]}
  };
</script>
`;

const SIZE_CHART_MODAL = `
<a data-action="a-modal" data-a-modal="{&quot;name&quot;:&quot;sizeGuide&quot;,&quot;width&quot;:600}">Size Chart</a>
<div id="sizeGuideModal" style="display:none">
  <table class="size-chart-table">
    <tr><th>Brand Size</th><th>IN Size</th><th>Waist (in)</th><th>Length (in)</th></tr>
    <tr><td>S</td><td>36</td><td>28-30</td><td>40</td></tr>
    <tr><td>M</td><td>38</td><td>30-32</td><td>40</td></tr>
    <tr><td>L</td><td>40</td><td>32-34</td><td>41</td></tr>
  </table>
</div>
`;

const DESCRIPTION_SECTION = `
<div id="feature-bullets">
  <ul><li><span class="a-list-item">Relaxed fit, breathable cotton.</span></li></ul>
</div>
<h2 id="productDescription_feature_div" class="a-spacing-mini"><span>Product description</span></h2>
<div id="productDescription">
  <p>This <b>relaxed-fit</b> cotton shirt is perfect for everyday wear. Breathable fabric keeps you cool all day.</p>
</div>
<h2>Product details</h2>
<div id="productDetails_feature_div">Some other section entirely.</div>
`;

const MATERIAL_ROW = `
<table id="productOverview_feature_div">
  <tr>
    <td class="a-span3"><span class="a-size-base a-text-bold">Fabric type</span></td>
    <td class="a-span9"><span class="a-size-base po-break-word">Cotton Blend</span></td>
  </tr>
</table>
`;

function buildFullPageHtml(opts: {
  gallery?: boolean;
  sizeChart?: boolean;
  description?: boolean;
  material?: boolean;
  name?: string;
  price?: string;
} = {}): string {
  const {
    gallery = true,
    sizeChart = true,
    description = true,
    material = true,
    name = "Men's Solid Regular Fit Cotton Shirt",
    price = '799',
  } = opts;

  return `
    <html>
    <head><title>${name} - Amazon.in</title></head>
    <body>
      <span id="productTitle" class="a-size-large product-title-word-break">
        ${name}
      </span>
      <span class="a-price-whole">${price}</span>
      ${gallery ? GALLERY_SCRIPT : ''}
      ${sizeChart ? SIZE_CHART_MODAL : ''}
      ${description ? DESCRIPTION_SECTION : ''}
      ${material ? MATERIAL_ROW : ''}
    </body>
    </html>
  `;
}

Deno.test('amazon parser: full extraction success — name, price, deduped gallery, size chart, description, material', () => {
  const html = buildFullPageHtml();
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE1');

  assert(result, 'expected a parsed product');
  if (!result) return;

  assertEquals(result.name, "Men's Solid Regular Fit Cotton Shirt");
  assertEquals(result.price, 799);
  assertEquals(result.mrp, 799);

  // Deduped — the fixture has 3 hiRes entries but only 2 unique URLs.
  assertEquals(result.imageUrls, [
    'https://m.media-amazon.com/images/I/71ABCDeqXL._SL1500_.jpg',
    'https://m.media-amazon.com/images/I/81WXYZfghL._SL1500_.jpg',
  ]);

  assertEquals(result.sizeChart, {
    S: { 'IN Size': '36', 'Waist (in)': '28-30', 'Length (in)': '40' },
    M: { 'IN Size': '38', 'Waist (in)': '30-32', 'Length (in)': '40' },
    L: { 'IN Size': '40', 'Waist (in)': '32-34', 'Length (in)': '41' },
  });

  assertEquals(
    result.description,
    'This relaxed-fit cotton shirt is perfect for everyday wear. Breathable fabric keeps you cool all day.',
  );

  assertEquals(result.material, 'Cotton Blend');
});

Deno.test('amazon parser: still extracts name/price when no richer fields are present at all (pre-existing behavior unchanged)', () => {
  const html = buildFullPageHtml({ gallery: false, sizeChart: false, description: false, material: false });
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE2');

  assert(result, 'expected a parsed product');
  if (!result) return;

  assertEquals(result.name, "Men's Solid Regular Fit Cotton Shirt");
  assertEquals(result.price, 799);
  assertEquals(result.imageUrls, []);
  assertEquals(result.sizeChart, null);
  assertEquals(result.description, null);
  assertEquals(result.material, null);
});

Deno.test('amazon parser: returns null (never a fabricated product) when productTitle is missing', () => {
  const html = '<html><body><span class="a-price-whole">799</span></body></html>';
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE3');
  assertEquals(result, null);
});

Deno.test('amazon parser: gallery — no hiRes entries in the page yields an empty array, not null/undefined', () => {
  const html = buildFullPageHtml({ gallery: false });
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE4');

  assert(result);
  if (!result) return;
  assertEquals(result.imageUrls, []);
});

Deno.test('amazon parser: size chart — no sizeGuide modal marker at all yields null', () => {
  const html = buildFullPageHtml({ sizeChart: false });
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE5');

  assert(result);
  if (!result) return;
  assertEquals(result.sizeChart, null);
});

Deno.test('amazon parser: size chart — a sizeGuide marker with a table that has fewer than 2 real columns yields null, never a garbled partial chart', () => {
  // material also disabled so the fixture has no other <table> anywhere
  // (e.g. MATERIAL_ROW's productOverview table) that could otherwise be
  // mistaken for the malformed size-guide table this test is checking.
  const html = buildFullPageHtml({ sizeChart: false, material: false }) + `
    <a data-a-modal="{&quot;name&quot;:&quot;sizeGuide&quot;}">Size Chart</a>
    <table>
      <tr><th>Brand Size</th></tr>
      <tr><td>S</td></tr>
    </table>
  `;
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE6');

  assert(result);
  if (!result) return;
  assertEquals(result.sizeChart, null);
});

Deno.test('amazon parser: size chart — a sizeGuide marker with no following <table> at all yields null', () => {
  // material also disabled — see the comment on the previous test.
  const html = buildFullPageHtml({ sizeChart: false, material: false }) + `
    <a data-a-modal="{&quot;name&quot;:&quot;sizeGuide&quot;}">Size Chart</a>
    <div>No table here, just some other markup.</div>
  `;
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE7');

  assert(result);
  if (!result) return;
  assertEquals(result.sizeChart, null);
});

Deno.test('amazon parser: description — no "Product description" text anywhere yields null', () => {
  const html = buildFullPageHtml({ description: false });
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE8');

  assert(result);
  if (!result) return;
  assertEquals(result.description, null);
});

Deno.test('amazon parser: material — no explicit Fabric/Material bullet yields null (never inferred/guessed)', () => {
  const html = buildFullPageHtml({ material: false });
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE9');

  assert(result);
  if (!result) return;
  assertEquals(result.material, null);
});

Deno.test('amazon parser: material — a plain inline "Fabric: <value>" statement (no span wrapper) is also recognized', () => {
  const html = buildFullPageHtml({ material: false }) + '<p>Fabric: Pure Cotton</p>';
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE10');

  assert(result);
  if (!result) return;
  assertEquals(result.material, 'Pure Cotton');
});

Deno.test('amazon parser: price falls back to 0 when no recognizable price markup is present (pre-existing behavior unchanged)', () => {
  const html = `<span id="productTitle">Plain Title</span>`;
  const result = parse(html, 'https://www.amazon.in/dp/B0EXAMPLE11');

  assert(result);
  if (!result) return;
  assertEquals(result.price, 0);
  assertEquals(result.mrp, 0);
});
