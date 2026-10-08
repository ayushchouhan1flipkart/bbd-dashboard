let CURRENT_MODE = 'DRY'; 
let CURRENT_LEVEL = 'BUYING'; 
let SHOW_ATTAINMENT = false;

let DATA_CACHE = { 'DRY': { RAW: null, HEADERS: [], COL_IDX: {}, lastUpdated: null }, 'MLE': { RAW: null, HEADERS: [], COL_IDX: {}, lastUpdated: null } };
let RAW_DATA = [], FILTERED_DATA = [], COL_IDX = {}, HEADERS = [];

const FILTER_MAP = {
  "BU": ["BU", "bu", "Updated_BU"],
  "SH": ["FC_Code", "fc_code", "SH", "Buying FC"],
  "FALLBACK": ["fallback_fc", "Fallback FC", "Fallback_FC", "fallback fc"],
  "ATTAINMENT_BUCKET": ["attainment_bucket", "Attainment Bucket", "attainment bucket"],
  "DOH_BUCKET": ["doh_bucket", "DOH Bucket", "doh bucket"],
  "OWNER": ["Instock_Owner", "Instock Owner"],
  "BRAND": ["brand", "Brand"],
  "VENDOR": ["Vendor_Name", "Vendor", "vendor"],
  "VERTICAL": ["analytic_vertical", "Vertical"],
  "GOURMET": ["Gourmet_Flag", "Gourmet Flag", "Gourmet"],
  "SUPERCAT": ["super_category", "Supercategory"],
  "TAGGING": ["tagging", "Tagging"],
  "VMI": ["VMI_Flag", "VMI"],
  "FSN": ["FSN", "fsn"],
  "UPDATED_BU": ["Updated_BU"],
  "BUY_NODE": ["Buying_Node_Flag", "Buying Node"],
  "BRAND_POC": ["brand_poc", "Brand POC"],
  "ZONE": ["Zone", "zone", "Zone *"],
  "REGIONAL": ["Regional_fsn_flag", "Regional FSN"],
  "SMNM_DEALS": ["SMNM Deals"],
  "BBD_DEAL": ["BBD Deal", "BBD_Deal"],
  "PARETO": ["pareto_type", "Pareto Type"],
  "SIZE": ["size_bucket", "Size Bucket"],
  "VOLUMETRIC": ["volumetric_flag", "Volumetric Flag"]
};

const KEY_MAPPINGS_DRY = { 'BU': ['BU', 'bu'], 'Zone': ['Zone', 'zone'], 'brand': ['brand', 'Brand'], 'Vendor_Name': ['Vendor_Name', 'Vendor'], 'analytic_vertical': ['analytic_vertical', 'Vertical'], 'super_category': ['super_category', 'Supercategory'], 'tagging': ['tagging', 'Tagging'], 'FC_Code': ['FC_Code', 'fc_code', 'SH'] };
const KEY_MAPPINGS_MLE = { 'BU': ['BU', 'bu'], 'Zone': ['Zone', 'zone'], 'brand': ['brand', 'Brand'], 'analytic_vertical': ['Analytical Vertical', 'Vertical'], 'super_category': ['Super category', 'Supercategory'], 'FC_Code': ['Buying FC', 'buying fc', 'SH'] };

$(document).ready(function() { $('.select2').select2({ width: '100%', placeholder: 'All' }); switchMode('DRY'); });

function switchMode(mode) {
  CURRENT_MODE = mode;
  if (mode === 'MLE') {
      $('.dry-only').hide(); $('.dry-only-tab').hide();
      $('.sh-label').text('Buying FC'); $('.sh-tab-label').text('Zone x Buying FC');
      if ($('.content-pane.active').attr('id') === 'doh-pane') switchTab($('[data-pane="summary-pane"]'));
      if ($('.sub-tab.active').hasClass('dry-only-tab')) { $('.sub-tab').removeClass('active'); $('[data-view="bu_zone"]').addClass('active'); }
  } else {
      $('.dry-only').show(); $('.dry-only-tab').show();
      $('.sh-label').text('SH (FC Code)'); $('.sh-tab-label').text('Zone x SH');
  }

  if (DATA_CACHE[mode].RAW) {
      RAW_DATA = DATA_CACHE[mode].RAW; HEADERS = DATA_CACHE[mode].HEADERS; COL_IDX = DATA_CACHE[mode].COL_IDX;
      FILTERED_DATA = RAW_DATA; 
      $('#last-updated-text').text(DATA_CACHE[mode].lastUpdated); $('#last-updated-badge').removeClass('d-none');
      populateFilters(); applyFilters();
  } else {
      $('#loader-text').text("Fetching " + mode + " Data..."); $('#loader-overlay').show(); progressFake(0, 40);
      google.script.run
        .withSuccessHandler(function(config) {
          if (config.updatedTime) { DATA_CACHE[mode].lastUpdated = config.updatedTime; $('#last-updated-text').text(config.updatedTime); $('#last-updated-badge').removeClass('d-none'); }
          downloadCSVDirectly(config);
        }).withFailureHandler(err => { alert("Error connecting: " + err); $('#loader-overlay').hide(); }).getDriveDataConfig(mode);
  }
}

function switchLevel(level) { CURRENT_LEVEL = level; refreshActivePane(); }
function switchAttainment(isActive) { SHOW_ATTAINMENT = isActive; refreshActivePane(); }
function openAttainmentTracker() { window.open('https://docs.google.com/spreadsheets/d/1xAE9r8ZsiMWepJsJr6dkdXewRNAgxEpWVjHARtdCZ7I', '_blank'); }

function downloadCSVDirectly(config) {
  $('#loader-text').text("Downloading " + CURRENT_MODE + " CSV..."); progressFake(40, 80);
  Papa.parse('https://www.googleapis.com/drive/v3/files/' + config.id + '?alt=media', { download: true, header: false, skipEmptyLines: true, worker: true, downloadRequestHeaders: { "Authorization": "Bearer " + config.token },
    complete: function(results) { processRawData(results.data); }, error: function(err) { alert("Error fetching data: " + err); $('#loader-overlay').hide(); } });
}

function processRawData(data) {
  $('#loader-text').text("Building Index..."); progressFake(80, 99);
  let newHeaders = data.shift().map(h => String(h).trim()); let newColIdx = {};
  newHeaders.forEach((h, i) => { newColIdx[h] = i; newColIdx[h.toLowerCase()] = i; newColIdx[String(h).trim()] = i; newColIdx[String(h).trim().toLowerCase()] = i; });
  DATA_CACHE[CURRENT_MODE].RAW = data; DATA_CACHE[CURRENT_MODE].HEADERS = newHeaders; DATA_CACHE[CURRENT_MODE].COL_IDX = newColIdx;
  RAW_DATA = data; HEADERS = newHeaders; COL_IDX = newColIdx; FILTERED_DATA = RAW_DATA; 
  populateFilters(); refreshActivePane(); $('#loader-overlay').fadeOut(300);
}

function progressFake(start, end) { let val = start; let timer = setInterval(() => { val += Math.random() * 5; if (val >= end) { val = end; clearInterval(timer); } }, 100); }

function getColIdx(names) {
  for (let n of names) { 
    if (!n) continue;
    if (COL_IDX[n] !== undefined) return COL_IDX[n];
    if (COL_IDX[n.toLowerCase()] !== undefined) return COL_IDX[n.toLowerCase()];
    if (COL_IDX[n.trim()] !== undefined) return COL_IDX[n.trim()];
    if (COL_IDX[n.trim().toLowerCase()] !== undefined) return COL_IDX[n.trim().toLowerCase()];
  }
  return -1;
}

function populateFilters() {
  let sets = {}; Object.keys(FILTER_MAP).forEach(k => sets[k] = new Set());
  RAW_DATA.forEach(row => { Object.keys(FILTER_MAP).forEach(uiKey => { let idx = getColIdx(FILTER_MAP[uiKey]); if (idx !== -1 && row[idx]) sets[uiKey].add(String(row[idx]).trim()); }); });
  Object.keys(FILTER_MAP).forEach(uiKey => {
    let el = $('#f-' + uiKey); el.empty();
    if (uiKey === 'FSN') { if (el.hasClass('select2-hidden-accessible')) el.select2('destroy'); let fsnArr = Array.from(sets[uiKey]).sort().map(v => ({ id: v, text: v })); el.select2({ placeholder: 'All', allowClear: true, data: fsnArr, minimumInputLength: 2, width: '100%' }); return; }
    Array.from(sets[uiKey]).sort().forEach(val => el.append(new Option(val, val)));
    if (!el.hasClass('select2-hidden-accessible')) el.select2({ placeholder: 'All', allowClear: true, width: '100%' });
  });
}

function applyFilters() {
  $('#loader-text').text("Applying Filters..."); $('#loader-overlay').show();
  setTimeout(() => {
    let activeFilters = {};
    Object.keys(FILTER_MAP).forEach(uiKey => { let vals = $('#f-' + uiKey).val(); if (vals && vals.length > 0) activeFilters[uiKey] = vals; });
    if (Object.keys(activeFilters).length === 0) FILTERED_DATA = RAW_DATA;
    else { FILTERED_DATA = RAW_DATA.filter(row => { for (let uiKey in activeFilters) { let idx = getColIdx(FILTER_MAP[uiKey]); if (idx === -1) continue; if (!activeFilters[uiKey].includes(String(row[idx]).trim())) return false; } return true; }); }
    refreshActivePane(); $('#loader-overlay').fadeOut(200);
  }, 50);
}

function num(val) { return parseFloat(val) || 0; }
function pctCap(n, d, cap) { if (!d || d === 0) return 0; let v = (n/d)*100; return Math.round((cap ? Math.min(v, 100) : v)*10)/10; }
function pctClass(v, colName) { 
  if (colName.includes('PO')) return v < 85 ? 'pct-bad' : (v < 95 ? 'pct-warn' : 'pct-good');
  else if (colName.includes('SCH')) return v < 80 ? 'pct-bad' : (v < 90 ? 'pct-warn' : 'pct-good');
  else return v < 75 ? 'pct-bad' : (v < 90 ? 'pct-warn' : 'pct-good');
}

function formatCrores(val) { if (typeof val !== 'number' || isNaN(val)) return val; return parseFloat((val / 10000000).toFixed(3)) + ' Cr'; }

function syncFrozenColumns(api, numFixed) {
    setTimeout(() => {
        let $table = $(api.table().node()); let $headerCells = $table.find('thead tr:first-child th'); let $gtCells = $table.find('thead tr.grandtotal-row th');
        $headerCells.each(function(index) {
            let $th = $(this); let $gtTh = $gtCells.eq(index);
            if ($th.hasClass('dtfc-fixed-left')) $gtTh.addClass('dtfc-fixed-left').css({'position': 'sticky', 'left': $th.css('left'), 'z-index': '11', 'background-color': 'var(--navy-light)', 'color': 'var(--minutes-yellow)'});
            else $gtTh.removeClass('dtfc-fixed-left').css({'position': 'relative', 'left': 'auto', 'z-index': '1'});
            $th.removeClass('boundary-col'); $gtTh.removeClass('boundary-col');
        });
        if (numFixed > 0) $table.find('tr').each(function() { $(this).find('th:nth-child(' + numFixed + '), td:nth-child(' + numFixed + ')').addClass('boundary-col'); });
    }, 50); 
}

// ==========================================
// 🔴 CUSTOM SORTED COMPACT MATRIX LOGIC
// ==========================================
function renderDohTab() {
  $('#doh-status').text(`Building DOH Matrix...`);
  const activeKeys = $('#doh-pane .sub-tab.active').data('keys').split(',');
  const idxMap = activeKeys.map(k => getColIdx(KEY_MAPPINGS_DRY[k] || [k]));
  
  let dohIdx = getColIdx(['doh_bucket', 'doh bucket']);
  let attIdx = getColIdx(['attainment_bucket', 'attainment bucket']);
  
  if (dohIdx === -1 || attIdx === -1) { $('#tbl-doh').html('<tr><td class="text-danger p-3 fw-bold">Error: "doh_bucket" or "attainment_bucket" columns not found in raw data.</td></tr>'); return; }
  
  // Custom Weights to force strict column sorting (removes invisible quotes automatically)
  function getW(map, val) {
      let cleanVal = String(val).trim().replace(/^'/, '');
      return map[cleanVal] || 99;
  }
  const dohWeights = {"0":1, "<2":2, "2-5":3, "5-10":4, "10-12":5, "12-15":6, ">15":7};
  const attWeights = {"<70":1, "70-120":2, "120-140":3, "140-200":4, ">200":5};

  let buckets = {}; let rawRows = [];
  FILTERED_DATA.forEach(row => {
      let doh = String(row[dohIdx] || 'Unassigned').trim();
      let att = String(row[attIdx] || 'Unassigned').trim();
      if(!buckets[doh]) buckets[doh] = new Set();
      buckets[doh].add(att);
      let keyParts = idxMap.map(idx => idx >= 0 ? (String(row[idx]||'Unassigned').trim()||'Unassigned') : 'Unassigned');
      rawRows.push({ keys: keyParts, doh: doh, att: att });
  });
  
  let sortedDoh = Object.keys(buckets).sort((a,b) => getW(dohWeights, a) - getW(dohWeights, b));
  let cols = [];
  sortedDoh.forEach(d => { 
      Array.from(buckets[d]).sort((a,b) => getW(attWeights, a) - getW(attWeights, b)).forEach(a => cols.push({doh: d, att: a})); 
  });
  
  let tree = {}; 
  rawRows.forEach(r => {
      let path = [];
      r.keys.forEach((k, depth) => {
          path.push(k); let pathStr = path.join('|||');
          if(!tree[pathStr]) tree[pathStr] = { name: k, depth: depth, path: pathStr, counts: {} };
          let colKey = r.doh + '|' + r.att;
          tree[pathStr].counts[colKey] = (tree[pathStr].counts[colKey] || 0) + 1; // Counts FSNs
      });
  });
  
  let thead1 = `<tr><th rowspan="2" class="dtfc-fixed-left boundary-col" style="z-index:12 !important; vertical-align:middle;">Hierarchy</th>`;
  let thead2 = `<tr>`;
  sortedDoh.forEach(d => {
      let atts = Array.from(buckets[d]).sort((a,b) => getW(attWeights, a) - getW(attWeights, b));
      thead1 += `<th colspan="${atts.length}" class="text-center">${d}</th>`;
      atts.forEach(a => { thead2 += `<th class="text-center">${a}</th>`; });
  });
  thead1 += `</tr>`; thead2 += `</tr>`;
  
  let sortedPaths = Object.keys(tree).sort(); let tbody = ``;
  sortedPaths.forEach(p => {
      let node = tree[p]; let indent = node.depth * 25;
      let isLeaf = node.depth === activeKeys.length - 1;
      let safePath = p.replace(/['"]/g, ''); 
      let icon = isLeaf ? `<span style="display:inline-block; width:12px; margin-right:8px;"></span>` : `<i class="bi bi-chevron-down toggle-icon text-danger" style="cursor:pointer;" onclick="toggleDohRow('${safePath}')"></i>`;
      let bgClass = node.depth === 0 ? 'doh-l1' : '';
      
      let rowHtml = `<tr class="doh-row ${bgClass}" data-path="${safePath}" data-depth="${node.depth}" ${node.depth > 0 ? 'style="display:none;"' : ''}>`;
      rowHtml += `<td class="dtfc-fixed-left boundary-col" style="padding-left: ${indent + 15}px !important; white-space:nowrap;">${icon} <span class="fw-bold">${node.name}</span></td>`;
      cols.forEach(c => {
          let val = node.counts[c.doh + '|' + c.att] || 0;
          rowHtml += `<td class="text-center">${val > 0 ? val.toLocaleString() : '-'}</td>`;
      });
      rowHtml += `</tr>`; tbody += rowHtml;
  });
  
  if ($.fn.DataTable.isDataTable('#tbl-doh')) $('#tbl-doh').DataTable().destroy();
  $('#tbl-doh').html(`<thead>${thead1}${thead2}</thead><tbody>${tbody}</tbody>`);
  
  $('#tbl-doh').DataTable({ ordering: false, paging: false, scrollY: '60vh', scrollX: true, scrollCollapse: true, info: false, fixedColumns: { leftColumns: 1 }, dom: 't', drawCallback: function() { syncFrozenColumns(this.api(), 1); } });
  setTimeout(() => { $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust(); }, 150);
}

window.toggleDohRow = function(path) {
    let $icon = $(`tr.doh-row[data-path="${path}"] .toggle-icon`);
    let isCollapsed = $icon.hasClass('bi-chevron-right');
    let targetDepth = parseInt($(`tr.doh-row[data-path="${path}"]`).attr('data-depth')) + 1;
    
    if (isCollapsed) {
        $icon.removeClass('bi-chevron-right').addClass('bi-chevron-down');
        $('.doh-row').each(function() {
            let p = $(this).attr('data-path'); let d = parseInt($(this).attr('data-depth'));
            if (p.startsWith(path + '|||') && d === targetDepth) $(this).show();
        });
    } else {
        $icon.removeClass('bi-chevron-down').addClass('bi-chevron-right');
        $('.doh-row').each(function() {
            let p = $(this).attr('data-path');
            if (p.startsWith(path + '|||') && p !== path) {
                $(this).hide();
                $(this).find('.toggle-icon').removeClass('bi-chevron-down').addClass('bi-chevron-right');
            }
        });
    }
    setTimeout(() => { $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust(); }, 50);
}

$(document).on('click', '.sub-tab', function() {
  $(this).siblings().removeClass('active'); $(this).addClass('active'); refreshActivePane();
});

$(document).on('click', 'tr.group-header', function() {
  let zoneSafe = $(this).data('zone'); let $wrapper = $(this).closest('.dataTables_wrapper');
  let $children = $wrapper.find('tr.child-of-' + zoneSafe);
  if ($(this).hasClass('collapsed')) { $(this).removeClass('collapsed'); $children.show(); } else { $(this).addClass('collapsed'); $children.hide(); }
  $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
});

function switchTab(el) {
  $('.pill-tab').removeClass('active'); $(el).addClass('active');
  $('.content-pane').removeClass('active'); $('#' + $(el).data('pane')).addClass('active');
  refreshActivePane();
}

function refreshActivePane() {
  const pane = $('.content-pane.active').attr('id');
  if (pane === 'detail-pane') renderDetailTab();
  else if (pane === 'doh-pane') renderDohTab();
  else renderActiveSubTab();
}

function aggregateDataDRY(keys) {
  let result = {};
  let idxMap = keys.map(k => getColIdx(KEY_MAPPINGS_DRY[k] || [k]));
  
  let mIdx = {
    buyNode: getColIdx(['Buying_Node_Flag', 'Buying Node']),
    qoh: getColIdx(['QOH', 'qoh']), dsRawAtp: getColIdx(['DS_Raw_ATP', 'DS Raw ATP']), openPo: getColIdx(['Open_PO', 'Open PO']),
    
    rollup_plan: getColIdx(['Rollup_BBD_Target']), rollup_base: getColIdx(['Rollup_BBD_Base']),
    gmv: getColIdx(['GMV', 'gmv']),
    exPo: getColIdx(['Excess PO', 'Excess_PO']), poShort: getColIdx(['PO_Shortfall', 'PO Shortfall']), exAtp: getColIdx(['Excess ATP', 'Excess_ATP']),
    rollup_mstn: getColIdx(['Rollup_BBD_MSTN']), rollup_mstn_sch: getColIdx(['Rollup_BBD_MSTN_SCH']), rollup_mstn_po: getColIdx(['Rollup_BBD_MSTN_PO']),
    
    p0_plan: getColIdx(['P0_BBD_target']), p0_base: getColIdx(['P0_BBD_Base']),
    p0_mstn: getColIdx(['P0_BBD_MSTN']), p0_mstn_sch: getColIdx(['P0_BBD_MSTN_SCH']), p0_mstn_po: getColIdx(['P0_BBD_MSTN_PO']),
    p0_gmv: getColIdx(['P0_gmv']),
    
    last3po: getColIdx(['Last3PO']), gmv_mstn: getColIdx(['bbd_mstn_gmv']), gmv_base: getColIdx(['bbd_gmv_base']),
    plan_till_hr: getColIdx(['BBD_plan_till_hour']), sale_till_hr: getColIdx(['bbd_sale_till_hour']),
    
    totDs: getColIdx(['Total_DS_Count']), instDs: getColIdx(['Instock_DS_Count']), dsNorm: getColIdx(['DS_Norm']), dsMstnBase: getColIdx(['DS_MSTN']),
    dsMstnIt: getColIdx(['ds_mstn_it', 'DS MSTN IT']), instDsIt: getColIdx(['instock_it_ds_count', 'ds_instock_it', 'DS Instock IT']),
    zonalIwit: getColIdx(['zonal_iwit_potential', 'zonal iwit potential'])
  };

  for (let i = 0; i < FILTERED_DATA.length; i++) {
    let row = FILTERED_DATA[i];
    let groupKey = idxMap.map(idx => idx >= 0 ? (String(row[idx]||'Unassigned').trim()||'Unassigned') : 'Unassigned').join('|||');
    if (groupKey.toLowerCase().includes('unassigned') || groupKey === '|||' || groupKey.trim() === '') continue;
    
    if (!result[groupKey]) {
      result[groupKey] = { __keyParts: groupKey.split('|||'), 
        qoh:0, dsRawAtp:0, openPo:0, 
        rollup_plan:0, rollup_base:0, gmv:0, exPo:0, poShort:0, exAtp:0, rollup_mstn:0, rollup_mstn_sch:0, rollup_mstn_po:0,
        p0_plan:0, p0_base:0, p0_gmv:0, p0_mstn:0, p0_mstn_sch:0, p0_mstn_po:0,
        last3po_sum:0, last3po_cnt:0, gmv_mstn:0, gmv_base:0, plan_till_hr:0, sale_till_hr:0,
        totDs:0, instDs:0, dsNorm:0, dsMstnBase:0, dsMstnIt:0, instDsIt:0, zonalIwit:0
      };
    }
    
    let b = result[groupKey];
    let isBuyNode = true; 
    if (mIdx.buyNode >= 0) {
      let bnVal = String(row[mIdx.buyNode] || '').trim().toUpperCase();
      isBuyNode = (bnVal === 'YES' || bnVal === 'Y' || bnVal === '1' || bnVal === 'TRUE');
    }

    b.qoh += num(row[mIdx.qoh]); b.dsRawAtp += num(row[mIdx.dsRawAtp]); b.openPo += num(row[mIdx.openPo]);
    b.plan_till_hr += num(row[mIdx.plan_till_hr]); b.sale_till_hr += num(row[mIdx.sale_till_hr]);
    
    b.totDs += num(row[mIdx.totDs]); b.instDs += num(row[mIdx.instDs]); b.dsNorm += num(row[mIdx.dsNorm]); b.dsMstnBase += num(row[mIdx.dsMstnBase]);
    b.dsMstnIt += num(row[mIdx.dsMstnIt]); b.instDsIt += num(row[mIdx.instDsIt]);

    b.gmv_mstn += num(row[mIdx.gmv_mstn]); b.gmv_base += num(row[mIdx.gmv_base]);
    b.zonalIwit += num(row[mIdx.zonalIwit]);

    let fRateStr = String(row[mIdx.last3po] || '').replace('%', '').trim();
    if(fRateStr !== '') { b.last3po_sum += (parseFloat(fRateStr) || 0); b.last3po_cnt += 1; }

    b.p0_plan += num(row[mIdx.p0_plan]); b.p0_base += num(row[mIdx.p0_base]); b.p0_gmv += num(row[mIdx.p0_gmv]);
    b.p0_mstn += num(row[mIdx.p0_mstn]); b.p0_mstn_sch += num(row[mIdx.p0_mstn_sch]); b.p0_mstn_po += num(row[mIdx.p0_mstn_po]);

    if (isBuyNode) {
      b.rollup_plan += num(row[mIdx.rollup_plan]); b.rollup_base += num(row[mIdx.rollup_base]); b.gmv += num(row[mIdx.gmv]); 
      b.exPo += num(row[mIdx.exPo]); b.poShort += num(row[mIdx.poShort]); b.exAtp += num(row[mIdx.exAtp]);
      b.rollup_mstn += num(row[mIdx.rollup_mstn]); b.rollup_mstn_sch += num(row[mIdx.rollup_mstn_sch]); b.rollup_mstn_po += num(row[mIdx.rollup_mstn_po]);
    }
  }
  return Object.values(result);
}

function aggregateDataMLE(keys) {
  let result = {};
  let idxMap = keys.map(k => getColIdx(KEY_MAPPINGS_MLE[k] || [k]));
  
  let mIdx = {
    bbd: getColIdx(['BBD', 'bbd']), shQoh: getColIdx(['SH QOH', 'sh qoh']), dsDeficit: getColIdx(['DS deficit', 'ds deficit']), openPo: getColIdx(['Open PO', 'open po']), dsQoh: getColIdx(['DS QOH', 'ds qoh']), nlSh: getColIdx(['NL-SH']), shSh: getColIdx(['SH-SH']), excessPo: getColIdx(['Excess PO', 'excess po']), excessQoh: getColIdx(['Excess QOH', 'excess qoh']), 
    bbdMstn: getColIdx(['BBD MSTN']), 
    bbdMstnNl: getColIdx(['BBD MSTN (NL)', 'bbd_mstn_nl_sh', 'bbd_mstn_nl']), 
    bbdMstnSh: getColIdx(['BBD MSTN (SH)', 'bbd_mstn_sh']), 
    bbdMstnSch: getColIdx(['BBD MSTN (SCH)', 'bbd_mstn_sch', 'Rollup_BBD_MSTN_SCH']), 
    bbdMstnPo: getColIdx(['BBD MSTN (PO)', 'bbd mstn po']), 
    poShortfall: getColIdx(['PO Shortfall', 'po shortfall']), overallBase: getColIdx(['Overall_base', 'overall base']),
    plan_till_hr: getColIdx(['BBD_plan_till_hour']), sale_till_hr: getColIdx(['bbd_sale_till_hour']),
    zonalIwit: getColIdx(['zonal_iwit_potential', 'zonal iwit potential'])
  };

  for (let i = 0; i < FILTERED_DATA.length; i++) {
    let row = FILTERED_DATA[i];
    let groupKey = idxMap.map(idx => idx >= 0 ? (String(row[idx]||'Unassigned').trim()||'Unassigned') : 'Unassigned').join('|||');
    if (groupKey.toLowerCase().includes('unassigned') || groupKey === '|||' || groupKey.trim() === '') continue;
    
    if (!result[groupKey]) {
      result[groupKey] = { __keyParts: groupKey.split('|||'), bbd:0, shQoh:0, dsDeficit:0, openPo:0, dsRawAtp:0, nlSh:0, shSh:0, excessPo:0, excessQoh:0, bbdMstn:0, bbdMstnNl:0, bbdMstnSh:0, bbdMstnSch:0, poShortfall:0, bbdMstnPo:0, overallBase:0, plan_till_hr:0, sale_till_hr:0, zonalIwit:0 };
    }
    
    let b = result[groupKey];
    b.bbd += num(row[mIdx.bbd]); b.shQoh += num(row[mIdx.shQoh]); b.dsDeficit += num(row[mIdx.dsDeficit]); b.openPo += num(row[mIdx.openPo]); b.dsRawAtp += num(row[mIdx.dsQoh]); b.nlSh += num(row[mIdx.nlSh]); b.shSh += num(row[mIdx.shSh]); b.excessPo += num(row[mIdx.excessPo]); b.excessQoh += num(row[mIdx.excessQoh]); b.bbdMstn += num(row[mIdx.bbdMstn]); b.bbdMstnNl += num(row[mIdx.bbdMstnNl]); b.bbdMstnSh += num(row[mIdx.bbdMstnSh]); b.bbdMstnSch += num(row[mIdx.bbdMstnSch]); b.poShortfall += num(row[mIdx.poShortfall]); b.bbdMstnPo += num(row[mIdx.bbdMstnPo]); b.overallBase += num(row[mIdx.overallBase]); b.plan_till_hr += num(row[mIdx.plan_till_hr]); b.sale_till_hr += num(row[mIdx.sale_till_hr]);
    b.zonalIwit += num(row[mIdx.zonalIwit]);
  }
  return Object.values(result);
}

function renderActiveSubTab() {
  const activeTab = $('#summary-pane .sub-tab.active'); const viewId = activeTab.data('view'); const keys = activeTab.data('keys').split(',');
  let rawRows = CURRENT_MODE === 'MLE' ? aggregateDataMLE(keys) : aggregateDataDRY(keys);
  
  let gt = CURRENT_MODE === 'DRY' 
      ? { rollup_plan:0, rollup_base:0, gmv:0, p0_plan:0, p0_base:0, p0_gmv:0, qoh:0, dsRawAtp:0, openPo:0, exPo:0, poShort:0, exAtp:0, rollup_mstn:0, rollup_mstn_sch:0, rollup_mstn_po:0, p0_mstn:0, p0_mstn_sch:0, p0_mstn_po:0, last3po_sum:0, last3po_cnt:0, gmv_mstn:0, gmv_base:0, plan_till_hr:0, sale_till_hr:0, totDs:0, instDs:0, dsNorm:0, dsMstnBase:0, dsMstnIt:0, instDsIt:0, zonalIwit:0 }
      : { bbd:0, shQoh:0, dsDeficit:0, openPo:0, dsRawAtp:0, nlSh:0, shSh:0, excessPo:0, excessQoh:0, bbdMstn:0, bbdMstnNl:0, bbdMstnSh:0, bbdMstnSch:0, poShortfall:0, bbdMstnPo:0, overallBase:0, plan_till_hr:0, sale_till_hr:0, zonalIwit:0 };
  
  rawRows.forEach(r => { Object.keys(gt).forEach(k => gt[k] += r[k]); });
  
  const processRow = (r) => {
    let out = {};
    out.__isGroupHeader = r.__isGroupHeader; out.__isChild = r.__isChild; out.__zoneSafe = r.__zoneSafe; out.__isSubtotal = r.__isSubtotal;
    keys.forEach((k, i) => out[k] = r.__keyParts ? r.__keyParts[i] : (i===0 ? 'GRAND TOTAL' : ''));
    
    if (CURRENT_MODE === 'DRY') {
        let isP0 = (CURRENT_LEVEL === 'SH_P0');
        out['BBD Plan'] = isP0 ? r.p0_plan : r.rollup_plan; 
        out['GMV'] = isP0 ? r.p0_gmv : r.gmv; 
        out['BBD Milestone'] = isP0 ? r.p0_base : r.rollup_base; 
        out['QOH'] = r.qoh; out['DS ATP'] = r.dsRawAtp; out['Open_PO'] = r.openPo; 
        out['Zonal IWIT Potential'] = r.zonalIwit;
        
        if (SHOW_ATTAINMENT) {
          out['BBD_plan_till_hour'] = r.plan_till_hr; out['bbd_sale_till_hour'] = r.sale_till_hr; out['BBD_attainment%'] = pctCap(r.sale_till_hr, r.plan_till_hr, false);
        } else {
          out['Fillrate %'] = r.last3po_cnt > 0 ? Math.round(r.last3po_sum / r.last3po_cnt) : 0;
        }

        out['Excess PO'] = r.exPo; out['PO Shortfall'] = r.poShort; out['Excess ATP'] = r.exAtp; 
        out['BBD_MSTN%'] = pctCap(isP0 ? r.p0_mstn : r.rollup_mstn, isP0 ? r.p0_base : r.rollup_base, true);
        out['BBD_MSTN_SCH%'] = pctCap(isP0 ? r.p0_mstn_sch : r.rollup_mstn_sch, isP0 ? r.p0_base : r.rollup_base, true); 
        out['BBD_MSTN_PO%'] = pctCap(isP0 ? r.p0_mstn_po : r.rollup_mstn_po, isP0 ? r.p0_base : r.rollup_base, true); 
        out['BBD_GMV_MSTN%'] = pctCap(r.gmv_mstn, r.gmv_base, true);
        out['DS Instock %'] = pctCap(r.instDs, r.totDs, true); 
        out['DS Instock IT %'] = pctCap(r.instDsIt, r.totDs, true);
        out['DS MSTN %'] = pctCap(r.dsMstnBase, r.dsNorm, true);
        out['DS MSTN IT %'] = pctCap(r.dsMstnIt, r.dsNorm, true);
    } else {
        out['BBD'] = r.bbd; out['SH QOH'] = r.shQoh; out['DS deficit'] = r.dsDeficit;
        out['Open PO'] = r.openPo; out['DS ATP'] = r.dsRawAtp; out['NL-SH'] = r.nlSh; out['SH-SH'] = r.shSh; 
        out['Zonal IWIT Potential'] = r.zonalIwit;

        if (SHOW_ATTAINMENT) {
          out['BBD_plan_till_hour'] = r.plan_till_hr; out['bbd_sale_till_hour'] = r.sale_till_hr; out['BBD_attainment%'] = pctCap(r.sale_till_hr, r.plan_till_hr, false);
        }

        out['Excess PO'] = r.excessPo; out['Excess QOH'] = r.excessQoh; out['PO Shortfall'] = r.poShortfall;
        out['BBD_MSTN%'] = pctCap(r.bbdMstn, r.overallBase, true); 
        out['BBD_MSTN_NL-SH%'] = pctCap(r.bbdMstnNl, r.overallBase, true);
        out['BBD_MSTN_SH-SH%'] = pctCap(r.bbdMstnSh, r.overallBase, true);
        out['BBD_MSTN_SCH%'] = pctCap(r.bbdMstnSch, r.overallBase, true);
        out['BBD_MSTN_PO%'] = pctCap(r.bbdMstnPo, r.overallBase, true);
    }
    return out;
  };

  let finalRawRows = [];
  if (viewId === 'bu_zone') {
    rawRows.sort((a, b) => (a.__keyParts[0] || '').localeCompare(b.__keyParts[0] || ''));
    let currentBU = null; let sub = null;
    const pushSubtotal = () => { if (sub) { sub.__keyParts = [currentBU + ' - Subtotal', '']; sub.__isSubtotal = true; finalRawRows.push(sub); } };
    rawRows.forEach(r => {
      let rowBU = r.__keyParts[0];
      if (rowBU !== currentBU) {
        pushSubtotal(); currentBU = rowBU;
        sub = CURRENT_MODE === 'DRY' 
            ? { rollup_plan:0, rollup_base:0, gmv:0, p0_plan:0, p0_base:0, p0_gmv:0, qoh:0, dsRawAtp:0, openPo:0, exPo:0, poShort:0, exAtp:0, rollup_mstn:0, rollup_mstn_sch:0, rollup_mstn_po:0, p0_mstn:0, p0_mstn_sch:0, p0_mstn_po:0, last3po_sum:0, last3po_cnt:0, gmv_mstn:0, gmv_base:0, plan_till_hr:0, sale_till_hr:0, totDs:0, instDs:0, dsNorm:0, dsMstnBase:0, dsMstnIt:0, instDsIt:0, zonalIwit:0 }
            : { bbd:0, shQoh:0, dsDeficit:0, openPo:0, dsRawAtp:0, nlSh:0, shSh:0, excessPo:0, excessQoh:0, bbdMstn:0, bbdMstnNl:0, bbdMstnSh:0, bbdMstnSch:0, poShortfall:0, bbdMstnPo:0, overallBase:0, plan_till_hr:0, sale_till_hr:0, zonalIwit:0 };
      }
      Object.keys(sub).forEach(k => { if(typeof sub[k] === 'number') sub[k] += r[k]; });
      finalRawRows.push(r);
    });
    pushSubtotal(); 
  } else if (viewId === 'zone_sh') {
    rawRows.sort((a, b) => (a.__keyParts[0] || '').localeCompare(b.__keyParts[0] || ''));
    let currentZone = null; let sub = null; let tempChildren = [];
    const pushZoneGroup = () => {
      if (sub) {
        sub.__keyParts = [currentZone, CURRENT_MODE === 'MLE' ? 'All Buying FCs' : 'All SHs'];
        sub.__isGroupHeader = true; sub.__zoneSafe = currentZone.replace(/[^a-zA-Z0-9]/g, ''); finalRawRows.push(sub);
        tempChildren.forEach(child => { child.__isChild = true; child.__zoneSafe = sub.__zoneSafe; finalRawRows.push(child); });
      }
    };
    rawRows.forEach(r => {
      let rowZone = r.__keyParts[0];
      if (rowZone !== currentZone) {
        pushZoneGroup(); currentZone = rowZone;
        sub = CURRENT_MODE === 'DRY' 
            ? { rollup_plan:0, rollup_base:0, gmv:0, p0_plan:0, p0_base:0, p0_gmv:0, qoh:0, dsRawAtp:0, openPo:0, exPo:0, poShort:0, exAtp:0, rollup_mstn:0, rollup_mstn_sch:0, rollup_mstn_po:0, p0_mstn:0, p0_mstn_sch:0, p0_mstn_po:0, last3po_sum:0, last3po_cnt:0, gmv_mstn:0, gmv_base:0, plan_till_hr:0, sale_till_hr:0, totDs:0, instDs:0, dsNorm:0, dsMstnBase:0, dsMstnIt:0, instDsIt:0, zonalIwit:0 }
            : { bbd:0, shQoh:0, dsDeficit:0, openPo:0, dsRawAtp:0, nlSh:0, shSh:0, excessPo:0, excessQoh:0, bbdMstn:0, bbdMstnNl:0, bbdMstnSh:0, bbdMstnSch:0, poShortfall:0, bbdMstnPo:0, overallBase:0, plan_till_hr:0, sale_till_hr:0, zonalIwit:0 };
        tempChildren = [];
      }
      Object.keys(sub).forEach(k => { if(typeof sub[k] === 'number') sub[k] += r[k]; });
      tempChildren.push(r);
    });
    pushZoneGroup();
  } else {
    finalRawRows = rawRows;
  }

  const rows = finalRawRows.map(processRow);
  const gtRow = processRow(gt);
  
  let safeProcess = CURRENT_MODE === 'DRY' ? 
        { rollup_plan:0, rollup_base:0, gmv:0, p0_plan:0, p0_base:0, p0_gmv:0, qoh:0, dsRawAtp:0, openPo:0, exPo:0, poShort:0, exAtp:0, rollup_mstn:0, rollup_mstn_sch:0, rollup_mstn_po:0, p0_mstn:0, p0_mstn_sch:0, p0_mstn_po:0, last3po_sum:0, last3po_cnt:0, gmv_mstn:0, gmv_base:0, plan_till_hr:0, sale_till_hr:0, totDs:0, instDs:0, dsNorm:0, dsMstnBase:0, dsMstnIt:0, instDsIt:0, zonalIwit:0 } : 
        { bbd:0, shQoh:0, dsDeficit:0, openPo:0, dsRawAtp:0, nlSh:0, shSh:0, excessPo:0, excessQoh:0, bbdMstn:0, bbdMstnNl:0, bbdMstnSh:0, bbdMstnSch:0, poShortfall:0, bbdMstnPo:0, overallBase:0, plan_till_hr:0, sale_till_hr:0, zonalIwit:0 };
  const sample = rows[0] || processRow(safeProcess);
  
  let pctCols = CURRENT_MODE === 'DRY' 
      ? ['BBD_MSTN%', 'BBD_MSTN_SCH%', 'BBD_MSTN_PO%', 'BBD_GMV_MSTN%', 'DS Instock %', 'DS Instock IT %', 'DS MSTN %', 'DS MSTN IT %', 'Fillrate %', 'BBD_attainment%']
      : ['BBD_MSTN%', 'BBD_MSTN_NL-SH%', 'BBD_MSTN_SH-SH%', 'BBD_MSTN_SCH%', 'BBD_MSTN_PO%', 'BBD_attainment%'];

  const cols = Object.keys(sample).filter(k => k !== '__keyParts' && k !== '__isSubtotal' && k !== '__isGroupHeader' && k !== '__isChild' && k !== '__zoneSafe');

  const dtCols = cols.map(c => ({
    title: c, data: c,
    render: function (val, type, row) {
      if (type !== 'display') return val;
      if (val === '') return '';

      if (viewId === 'zone_sh') {
        if (c === keys[0]) {
          if (row.__isGroupHeader) return `<i class="bi bi-chevron-down toggle-icon"></i> <span class="fw-bold">${val}</span>`;
          if (row.__isChild) return `<span class="text-muted" style="opacity:0.6;">${val}</span>`;
        }
        if (c === keys[1]) {
          if (row.__isGroupHeader) return `<span class="text-muted fst-italic">Zone Subtotal</span>`;
          if (row.__isChild) return `<span class="child-indent"></span>${val}`;
        }
      }
      
      if (c === 'GMV') return formatCrores(val);

      if (pctCols.includes(c)) return '<span class="' + pctClass(parseFloat(val)||0, c) + '">' + val + (String(val).includes('%')?'':'%') + '</span>';
      if (typeof val === 'number') return Math.round(val).toLocaleString();
      return val || '';
    }
  }));

  let theadHtml = `<tr>` + dtCols.map(c => `<th>${c.title}</th>`).join('') + `</tr>`;
  let gtHtml = `<tr class="grandtotal-row">` + cols.map((c, i) => {
      let val = gtRow[c];
      if (c === 'GMV') val = formatCrores(val);
      else if (pctCols.includes(c)) val = (val || 0) + (String(val).includes('%')?'':'%');
      else if (typeof val === 'number') val = Math.round(val).toLocaleString(); 
      return `<th>${val || ''}</th>`;
  }).join('') + `</tr>`;

  if ($.fn.DataTable.isDataTable('#tbl-summary-dynamic')) $('#tbl-summary-dynamic').DataTable().destroy();
  $('#tbl-summary-dynamic').empty().html(`<thead>${theadHtml}${gtHtml}</thead><tbody></tbody>`);
  
  let numFixed = (viewId === 'bu_zone' || viewId === 'zone_sh') ? 2 : 1;
  
  $('#tbl-summary-dynamic').DataTable({
    data: rows, columns: dtCols, pageLength: 15, scrollX: true, orderCellsTop: true, order: [], ordering: (viewId !== 'bu_zone' && viewId !== 'zone_sh'), 
    fixedColumns: { leftColumns: numFixed },
    dom: 'Q<"row mt-3"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rtip',
    drawCallback: function() { syncFrozenColumns(this.api(), numFixed); },
    createdRow: function (row, data) {
      if (data.__isSubtotal) $(row).addClass('subtotal-row');
      if (data.__isGroupHeader) $(row).addClass('group-header').attr('data-zone', data.__zoneSafe);
      if (data.__isChild) $(row).addClass('child-row child-of-' + data.__zoneSafe);
    }
  });
  $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
}

function renderDetailTab() {
  $('#detail-status').text(`Rendering matching rows...`);
  
  let detailKeys = CURRENT_MODE === 'DRY' 
      ? ['BU', 'Zone', 'brand', 'FC_Code', 'FSN', 'Title', 'analytic_vertical', 'super_category', 'Vendor_Name', 'GMV', 'zonal_iwit_potential', 'P0_gmv', 'QOH', 'DS_Raw_ATP', 'Open_PO', 'Excess PO', 'PO_Shortfall', 'Excess ATP', 'Rollup_BBD_Target', 'P0_BBD_target', 'Rollup_BBD_Base', 'P0_BBD_Base', 'Rollup_BBD_MSTN', 'P0_BBD_MSTN', 'Rollup_BBD_MSTN_SCH', 'P0_BBD_MSTN_SCH', 'Rollup_BBD_MSTN_PO', 'P0_BBD_MSTN_PO', 'bbd_mstn_gmv', 'bbd_gmv_base', 'Last3PO', 'BBD_plan_till_hour', 'bbd_sale_till_hour', 'Total_DS_Count', 'Instock_DS_Count', 'DS_Norm', 'DS_MSTN', 'ds_mstn_it', 'instock_it_ds_count', 'ds_instock_it', 'Buying_Node_Flag']
      : ['Zone', 'Buying FC', 'FSN', 'BU', 'Analytical Vertical', 'Title', 'brand', 'Super category', 'pareto_type', 'size_bucket', 'BBD', 'zonal_iwit_potential', 'SH QOH', 'DS deficit', 'Open PO', 'DS QOH', 'NL-SH', 'SH-SH', 'Excess PO', 'Excess QOH', 'BBD MSTN', 'bbd_mstn_nl_sh', 'BBD MSTN (NL)', 'BBD MSTN (SH)', 'bbd_mstn_sh', 'BBD MSTN (SCH)', 'bbd_mstn_sch', 'PO Shortfall', 'BBD MSTN (PO)', 'Overall_base', 'BBD_plan_till_hour', 'bbd_sale_till_hour'];

  const idxMap = {};
  detailKeys.forEach(k => idxMap[k] = getColIdx([k, k.toLowerCase(), k.replace(/_/g, ' ')]));
  let buyNodeIdx = getColIdx(['Buying_Node_Flag', 'Buying Node']);
  let instDsItIdx = getColIdx(['instock_it_ds_count', 'ds_instock_it']);

  let validDetailData = FILTERED_DATA.filter(row => {
      let buVal = String(row[idxMap['BU']] || '').trim().toLowerCase();
      let zoneVal = String(row[idxMap['Zone']] || '').trim().toLowerCase();
      return buVal !== '' && buVal !== 'unassigned' && zoneVal !== '' && zoneVal !== 'unassigned';
  });

  const displayData = validDetailData.slice(0, 5000); 
  if (validDetailData.length > 5000) { $('#detail-status').append(' <span class="text-danger">(Showing first 5,000 for browser speed. Use Filters to narrow down or export).</span>'); }

  let gt = CURRENT_MODE === 'DRY' 
      ? { rollup_plan:0, rollup_base:0, gmv:0, p0_plan:0, p0_base:0, p0_gmv:0, qoh:0, dsRawAtp:0, openPo:0, exPo:0, poShort:0, exAtp:0, rollup_mstn:0, rollup_mstn_sch:0, rollup_mstn_po:0, p0_mstn:0, p0_mstn_sch:0, p0_mstn_po:0, last3po_sum:0, last3po_cnt:0, gmv_mstn:0, gmv_base:0, plan_till_hr:0, sale_till_hr:0, totDs:0, instDs:0, dsNorm:0, dsMstnBase:0, dsMstnIt:0, instDsIt:0, zonalIwit:0 }
      : { bbd:0, shQoh:0, dsDeficit:0, openPo:0, dsRawAtp:0, nlSh:0, shSh:0, excessPo:0, excessQoh:0, bbdMstn:0, bbdMstnNl:0, bbdMstnSh:0, bbdMstnSch:0, poShortfall:0, bbdMstnPo:0, overallBase:0, plan_till_hr:0, sale_till_hr:0, zonalIwit:0 };

  if (CURRENT_MODE === 'DRY') {
      validDetailData.forEach(row => {
        let isBuyNode = true; if (buyNodeIdx >= 0) { let bnVal = String(row[buyNodeIdx] || '').trim().toUpperCase(); isBuyNode = (bnVal === 'YES' || bnVal === 'Y' || bnVal === '1' || bnVal === 'TRUE'); }
        gt.qoh += num(row[idxMap['QOH']]); gt.dsRawAtp += num(row[idxMap['DS_Raw_ATP']]); gt.openPo += num(row[idxMap['Open_PO']]);
        gt.p0_plan += num(row[idxMap['P0_BBD_target']]); gt.p0_base += num(row[idxMap['P0_BBD_Base']]); gt.p0_gmv += num(row[idxMap['P0_gmv']]);
        gt.p0_mstn += num(row[idxMap['P0_BBD_MSTN']]); gt.p0_mstn_sch += num(row[idxMap['P0_BBD_MSTN_SCH']]); gt.p0_mstn_po += num(row[idxMap['P0_BBD_MSTN_PO']]);
        gt.plan_till_hr += num(row[idxMap['BBD_plan_till_hour']]); gt.sale_till_hr += num(row[idxMap['bbd_sale_till_hour']]);
        gt.gmv_mstn += num(row[idxMap['bbd_mstn_gmv']]); gt.gmv_base += num(row[idxMap['bbd_gmv_base']]);
        gt.totDs += num(row[idxMap['Total_DS_Count']]); gt.instDs += num(row[idxMap['Instock_DS_Count']]); gt.dsNorm += num(row[idxMap['DS_Norm']]); gt.dsMstnBase += num(row[idxMap['DS_MSTN']]);
        gt.dsMstnIt += num(row[idxMap['ds_mstn_it']]); gt.instDsIt += num(row[instDsItIdx]);
        gt.zonalIwit += num(row[idxMap['zonal_iwit_potential']]);
        
        let fRateStr = String(row[idxMap['Last3PO']] || '').replace('%', '').trim();
        if(fRateStr !== '') { gt.last3po_sum += (parseFloat(fRateStr) || 0); gt.last3po_cnt += 1; }

        if (isBuyNode) {
          gt.rollup_plan += num(row[idxMap['Rollup_BBD_Target']]); gt.gmv += num(row[idxMap['GMV']]); gt.rollup_base += num(row[idxMap['Rollup_BBD_Base']]); gt.exPo += num(row[idxMap['Excess PO']]); gt.poShort += num(row[idxMap['PO_Shortfall']]); gt.exAtp += num(row[idxMap['Excess ATP']]); gt.rollup_mstn += num(row[idxMap['Rollup_BBD_MSTN']]); gt.rollup_mstn_sch += num(row[idxMap['Rollup_BBD_MSTN_SCH']]); gt.rollup_mstn_po += num(row[idxMap['Rollup_BBD_MSTN_PO']]);
        }
      });
  } else {
      let bbdMstnNlIdx = getColIdx(['BBD MSTN (NL)', 'bbd_mstn_nl_sh', 'bbd_mstn_nl']);
      let bbdMstnShIdx = getColIdx(['BBD MSTN (SH)', 'bbd_mstn_sh']);
      let bbdMstnSchIdx = getColIdx(['BBD MSTN (SCH)', 'bbd_mstn_sch', 'Rollup_BBD_MSTN_SCH']);

      validDetailData.forEach(row => {
          gt.bbd += num(row[idxMap['BBD']]); gt.shQoh += num(row[idxMap['SH QOH']]); gt.dsDeficit += num(row[idxMap['DS deficit']]); gt.openPo += num(row[idxMap['Open PO']]); gt.dsRawAtp += num(row[idxMap['DS QOH']]); gt.nlSh += num(row[idxMap['NL-SH']]); gt.shSh += num(row[idxMap['SH-SH']]); gt.excessPo += num(row[idxMap['Excess PO']]); gt.excessQoh += num(row[idxMap['Excess QOH']]); gt.bbdMstn += num(row[idxMap['BBD MSTN']]); 
          gt.bbdMstnNl += num(row[bbdMstnNlIdx]); gt.bbdMstnSh += num(row[bbdMstnShIdx]); gt.bbdMstnSch += num(row[bbdMstnSchIdx]);
          gt.poShortfall += num(row[idxMap['PO Shortfall']]); gt.bbdMstnPo += num(row[idxMap['BBD MSTN (PO)']]); gt.overallBase += num(row[idxMap['Overall_base']]); gt.plan_till_hr += num(row[idxMap['BBD_plan_till_hour']]); gt.sale_till_hr += num(row[idxMap['bbd_sale_till_hour']]);
          gt.zonalIwit += num(row[idxMap['zonal_iwit_potential']]);
      });
  }

  const processDetail = (row) => {
    let r = {};
    detailKeys.forEach(k => {
      let val = row[idxMap[k]];
      if(k !== 'BU' && k !== 'Zone' && k !== 'brand' && k !== 'FC_Code' && k !== 'FSN' && k !== 'Title' && k !== 'analytic_vertical' && k !== 'super_category' && k !== 'Vendor_Name' && k !== 'Buying FC' && k !== 'pareto_type' && k !== 'size_bucket' && k !== 'Last3PO' && k !== 'Buying_Node_Flag') r[k] = num(val);
      else r[k] = val;
    });

    let out = {};
    if (CURRENT_MODE === 'DRY') {
        let isBuyNode = true; if (buyNodeIdx >= 0) { let bnVal = String(row[buyNodeIdx] || '').trim().toUpperCase(); isBuyNode = (bnVal === 'YES' || bnVal === 'Y' || bnVal === '1' || bnVal === 'TRUE'); }
        if (!isBuyNode) { r['Rollup_BBD_Target'] = 0; r['GMV'] = 0; r['Rollup_BBD_Base'] = 0; r['Excess PO'] = 0; r['PO_Shortfall'] = 0; r['Excess ATP'] = 0; r['Rollup_BBD_MSTN_SCH'] = 0; r['Rollup_BBD_MSTN'] = 0; r['Rollup_BBD_MSTN_PO'] = 0; }
        
        let isP0 = (CURRENT_LEVEL === 'SH_P0');
        ['BU', 'Zone', 'brand', 'FC_Code', 'FSN', 'Title', 'analytic_vertical', 'super_category', 'Vendor_Name'].forEach(k => out[k] = r[k]);
        
        out['BBD Plan'] = isP0 ? r['P0_BBD_target'] : r['Rollup_BBD_Target']; 
        out['GMV'] = isP0 ? r['P0_gmv'] : r['GMV']; 
        out['BBD Milestone'] = isP0 ? r['P0_BBD_Base'] : r['Rollup_BBD_Base']; 
        out['QOH'] = r['QOH']; out['DS ATP'] = r['DS_Raw_ATP']; out['Open_PO'] = r['Open_PO']; 
        out['Zonal IWIT Potential'] = r['zonal_iwit_potential'];
        
        if (SHOW_ATTAINMENT) {
          out['BBD_plan_till_hour'] = r['BBD_plan_till_hour']; out['bbd_sale_till_hour'] = r['bbd_sale_till_hour']; out['BBD_attainment%'] = pctCap(r['bbd_sale_till_hour'], r['BBD_plan_till_hour'], false);
        } else {
          out['Fillrate %'] = r['Last3PO'] || '';
        }

        out['Excess PO'] = r['Excess PO']; out['PO Shortfall'] = r['PO_Shortfall']; out['Excess ATP'] = r['Excess ATP']; 
        out['BBD_MSTN%'] = pctCap(isP0 ? r['P0_BBD_MSTN'] : r['Rollup_BBD_MSTN'], isP0 ? r['P0_BBD_Base'] : r['Rollup_BBD_Base'], true); 
        out['BBD_MSTN_SCH%'] = pctCap(isP0 ? r['P0_BBD_MSTN_SCH'] : r['Rollup_BBD_MSTN_SCH'], isP0 ? r['P0_BBD_Base'] : r['Rollup_BBD_Base'], true); 
        out['BBD_MSTN_PO%'] = pctCap(isP0 ? r['P0_BBD_MSTN_PO'] : r['Rollup_BBD_MSTN_PO'], isP0 ? r['P0_BBD_Base'] : r['Rollup_BBD_Base'], true); 
        out['BBD_GMV_MSTN%'] = pctCap(r['bbd_mstn_gmv'], r['bbd_gmv_base'], true);
        out['DS Instock %'] = pctCap(r['Instock_DS_Count'], r['Total_DS_Count'], true); 
        out['DS Instock IT %'] = pctCap(row[instDsItIdx], r['Total_DS_Count'], true);
        out['DS MSTN %'] = pctCap(r['DS_MSTN'], r['DS_Norm'], true);
        out['DS MSTN IT %'] = pctCap(r['ds_mstn_it'], r['DS_Norm'], true);
    } else {
        ['Zone', 'Buying FC', 'FSN', 'BU', 'Analytical Vertical', 'Title', 'brand', 'Super category', 'pareto_type', 'size_bucket'].forEach(k => out[k] = r[k]);
        out['BBD'] = r['BBD']; out['SH QOH'] = r['SH QOH']; out['DS deficit'] = r['DS deficit']; out['Open PO'] = r['Open PO']; out['DS ATP'] = r['DS QOH']; out['NL-SH'] = r['NL-SH']; out['SH-SH'] = r['SH-SH']; 
        out['Zonal IWIT Potential'] = r['zonal_iwit_potential'];

        if (SHOW_ATTAINMENT) {
          out['BBD_plan_till_hour'] = r['BBD_plan_till_hour']; out['bbd_sale_till_hour'] = r['bbd_sale_till_hour']; out['BBD_attainment%'] = pctCap(r['bbd_sale_till_hour'], r['BBD_plan_till_hour'], false);
        }

        let bbdMstnNlIdx = getColIdx(['BBD MSTN (NL)', 'bbd_mstn_nl_sh', 'bbd_mstn_nl']);
        let bbdMstnShIdx = getColIdx(['BBD MSTN (SH)', 'bbd_mstn_sh']);
        let bbdMstnSchIdx = getColIdx(['BBD MSTN (SCH)', 'bbd_mstn_sch', 'Rollup_BBD_MSTN_SCH']);

        out['Excess PO'] = r['Excess PO']; out['Excess QOH'] = r['Excess QOH']; out['PO Shortfall'] = r['PO Shortfall'];
        out['BBD_MSTN%'] = pctCap(r['BBD MSTN'], r['Overall_base'], true); 
        out['BBD_MSTN_NL-SH%'] = pctCap(row[bbdMstnNlIdx], r['Overall_base'], true);
        out['BBD_MSTN_SH-SH%'] = pctCap(row[bbdMstnShIdx], r['Overall_base'], true);
        out['BBD_MSTN_SCH%'] = pctCap(row[bbdMstnSchIdx], r['Overall_base'], true);
        out['BBD_MSTN_PO%'] = pctCap(r['BBD MSTN (PO)'], r['Overall_base'], true);
    }
    return out;
  };

  const rows = displayData.map(processDetail);
  window.DETAIL_EXPORT_DATA = validDetailData.map(processDetail);
  
  let gtRow = {};
  if (CURRENT_MODE === 'DRY') {
      let isP0 = (CURRENT_LEVEL === 'SH_P0');
      gtRow = { 'BU': 'GRAND TOTAL', 'Zone': '', 'brand': '', 'FC_Code': '', 'FSN': '', 'Title': '', 'analytic_vertical': '', 'super_category': '', 'Vendor_Name': '', 'BBD Plan': isP0?gt.p0_plan:gt.rollup_plan, 'GMV': isP0?gt.p0_gmv:gt.gmv, 'BBD Milestone': isP0?gt.p0_base:gt.rollup_base, 'QOH': gt.qoh, 'DS ATP': gt.dsRawAtp, 'Open_PO': gt.openPo, 'Zonal IWIT Potential': gt.zonalIwit, 'Excess PO': gt.exPo, 'PO Shortfall': gt.poShort, 'Excess ATP': gt.exAtp, 'BBD_MSTN%': pctCap(isP0?gt.p0_mstn:gt.rollup_mstn, isP0?gt.p0_base:gt.rollup_base, true), 'BBD_MSTN_SCH%': pctCap(isP0?gt.p0_mstn_sch:gt.rollup_mstn_sch, isP0?gt.p0_base:gt.rollup_base, true), 'BBD_MSTN_PO%': pctCap(isP0?gt.p0_mstn_po:gt.rollup_mstn_po, isP0?gt.p0_base:gt.rollup_base, true), 'BBD_GMV_MSTN%': pctCap(gt.gmv_mstn, gt.gmv_base, true), 'DS Instock %': pctCap(gt.instDs, gt.totDs, true), 'DS Instock IT %': pctCap(gt.instDsIt, gt.totDs, true), 'DS MSTN %': pctCap(gt.dsMstnBase, gt.dsNorm, true), 'DS MSTN IT %': pctCap(gt.dsMstnIt, gt.dsNorm, true) };
      if (SHOW_ATTAINMENT) { gtRow['BBD_plan_till_hour'] = gt.plan_till_hr; gtRow['bbd_sale_till_hour'] = gt.sale_till_hr; gtRow['BBD_attainment%'] = pctCap(gt.sale_till_hr, gt.plan_till_hr, false); } 
      else { gtRow['Fillrate %'] = gt.last3po_cnt > 0 ? Math.round(gt.last3po_sum / gt.last3po_cnt) + '%' : ''; }
  } else {
      gtRow = { 'Zone': 'GRAND TOTAL', 'Buying FC': '', 'FSN': '', 'BU': '', 'Analytical Vertical': '', 'Title': '', 'brand': '', 'Super category': '', 'pareto_type': '', 'size_bucket': '', 'BBD': gt.bbd, 'SH QOH': gt.shQoh, 'DS deficit': gt.dsDeficit, 'Open PO': gt.openPo, 'DS ATP': gt.dsRawAtp, 'NL-SH': gt.nlSh, 'SH-SH': gt.shSh, 'Zonal IWIT Potential': gt.zonalIwit, 'Excess PO': gt.excessPo, 'Excess QOH': gt.excessQoh, 'PO Shortfall': gt.poShortfall, 'BBD_MSTN%': pctCap(gt.bbdMstn, gt.overallBase, true), 'BBD_MSTN_NL-SH%': pctCap(gt.bbdMstnNl, gt.overallBase, true), 'BBD_MSTN_SH-SH%': pctCap(gt.bbdMstnSh, gt.overallBase, true), 'BBD_MSTN_SCH%': pctCap(gt.bbdMstnSch, gt.overallBase, true), 'BBD_MSTN_PO%': pctCap(gt.bbdMstnPo, gt.overallBase, true) };
      if (SHOW_ATTAINMENT) { gtRow['BBD_plan_till_hour'] = gt.plan_till_hr; gtRow['bbd_sale_till_hour'] = gt.sale_till_hr; gtRow['BBD_attainment%'] = pctCap(gt.sale_till_hr, gt.plan_till_hr, false); }
  }

  const sample = rows[0] || gtRow;
  let pctCols = CURRENT_MODE === 'DRY' 
      ? ['BBD_MSTN%', 'BBD_MSTN_SCH%', 'BBD_MSTN_PO%', 'BBD_GMV_MSTN%', 'DS Instock %', 'DS Instock IT %', 'DS MSTN %', 'DS MSTN IT %', 'Fillrate %', 'BBD_attainment%']
      : ['BBD_MSTN%', 'BBD_MSTN_NL-SH%', 'BBD_MSTN_SH-SH%', 'BBD_MSTN_SCH%', 'BBD_MSTN_PO%', 'BBD_attainment%'];
  
  const dtCols = Object.keys(sample).map(c => ({
    title: c, data: c,
    render: function (val, type) {
      if (type !== 'display') return val;
      if (c === 'GMV') return formatCrores(val);
      if (pctCols.includes(c)) return '<span class="' + pctClass(parseFloat(val)||0, c) + '">' + val + (String(val).includes('%')?'':'%') + '</span>';
      if (typeof val === 'number') return Math.round(val).toLocaleString();
      return val || '';
    }
  }));

  let theadHtml = `<tr>` + dtCols.map(c => `<th>${c.title}</th>`).join('') + `</tr>`;
  let gtHtml = `<tr class="grandtotal-row">` + dtCols.map(c => {
      let val = gtRow[c.data];
      if (c.data === 'GMV') val = formatCrores(val);
      else if (pctCols.includes(c.data)) val = (val || 0) + (String(val).includes('%')?'':'%');
      else if (typeof val === 'number') val = Math.round(val).toLocaleString(); 
      return `<th>${val === undefined || val === '' ? '' : val}</th>`;
  }).join('') + `</tr>`;

  if ($.fn.DataTable.isDataTable('#tbl-detail')) $('#tbl-detail').DataTable().destroy();
  $('#tbl-detail').empty().html(`<thead>${theadHtml}${gtHtml}</thead><tbody></tbody>`);
  
  let numFixed = 2; 
  
  $('#tbl-detail').DataTable({
    data: rows, columns: dtCols, scrollX: true, paging: true, deferRender: true, pageLength: 100, orderCellsTop: true,
    fixedColumns: { leftColumns: numFixed },
    dom: 'Q<"row mt-3"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rtip',
    drawCallback: function() { syncFrozenColumns(this.api(), numFixed); }
  });
  $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
}

function toggleFullScreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else if (document.exitFullscreen) document.exitFullscreen();
}

function exportVisibleTableCSV() {
  const activePane = $('.content-pane.active').attr('id');
  let tableId = '';
  if(activePane === 'summary-pane') tableId = '#tbl-summary-dynamic';
  else if(activePane === 'detail-pane') tableId = '#tbl-detail';
  else if(activePane === 'doh-pane') tableId = '#tbl-doh';
  
  if (!$.fn.DataTable.isDataTable(tableId)) return;
  const dt = $(tableId).DataTable();
  let csv = []; 
  
  if(activePane === 'doh-pane') {
      $(tableId).find('thead tr').each(function() {
          let rowArr = []; $(this).find('th').each(function() { rowArr.push('"' + $(this).text().replace(/"/g, '""') + '"'); });
          csv.push(rowArr.join(','));
      });
      $(tableId).find('tbody tr:visible').each(function() {
          let rowArr = []; $(this).find('td').each(function() { rowArr.push('"' + $(this).text().replace(/"/g, '""') + '"'); });
          csv.push(rowArr.join(','));
      });
  } else {
      let cols = dt.settings()[0].aoColumns;
      let headers = [];
      $(tableId).find('thead tr:first th').each(function() { headers.push('"' + $(this).text().replace(/"/g, '""') + '"'); });
      csv.push(headers.join(','));
      let gTotals = [];
      $(tableId).find('thead tr.grandtotal-row th').each(function() { gTotals.push('"' + $(this).text().replace(/"/g, '""') + '"'); });
      if(gTotals.length > 0) csv.push(gTotals.join(','));

      let pctCols = CURRENT_MODE === 'DRY' 
          ? ['BBD_MSTN%', 'BBD_MSTN_SCH%', 'BBD_MSTN_PO%', 'BBD_GMV_MSTN%', 'DS Instock %', 'DS Instock IT %', 'DS MSTN %', 'DS MSTN IT %', 'Fillrate %', 'BBD_attainment%']
          : ['BBD_MSTN%', 'BBD_MSTN_NL-SH%', 'BBD_MSTN_SH-SH%', 'BBD_MSTN_SCH%', 'BBD_MSTN_PO%', 'BBD_attainment%'];

      if (activePane === 'summary-pane') {
          dt.rows({ search: 'applied' }).every(function () {
             let rowDataObj = this.data(); let rowArr = [];
             for (let i = 0; i < cols.length; i++) {
                 let dataProp = cols[i].mData; let val = rowDataObj[dataProp];
                 if (dataProp === 'GMV') val = formatCrores(val);
                 else if (pctCols.includes(dataProp) && val !== undefined && val !== '') val = val + (String(val).includes('%')?'':'%');
                 else if (typeof val === 'number') val = Math.round(val);
                 else if (val === undefined || val === null) val = '';

                 if (rowDataObj.__isGroupHeader) {
                     if (i === 0) val = rowDataObj[dataProp];
                     else if (i === 1) val = CURRENT_MODE === 'MLE' ? 'Buying FC Subtotal' : 'Zone Subtotal';
                     else val = '';
                 }
                 rowArr.push('"' + String(val).replace(/"/g, '""') + '"');
             }
             csv.push(rowArr.join(','));
          });
      } else {
          if (!window.DETAIL_EXPORT_DATA) return;
          window.DETAIL_EXPORT_DATA.forEach(row => {
             let rowArr = [];
             for (let i = 0; i < cols.length; i++) {
                 let dataProp = cols[i].mData; let val = row[dataProp];
                 if (dataProp === 'GMV') val = formatCrores(val);
                 else if (pctCols.includes(dataProp) && val !== undefined && val !== '') val = val + (String(val).includes('%')?'':'%');
                 else if (typeof val === 'number') val = Math.round(val);
                 else if (val === undefined || val === null) val = '';
                 rowArr.push('"' + String(val).replace(/"/g, '""') + '"');
             }
             csv.push(rowArr.join(','));
          });
      }
  }
  const blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a'); link.setAttribute('href', URL.createObjectURL(blob)); link.setAttribute('download', CURRENT_MODE + '_Dashboard_Export_' + new Date().toISOString().split('T')[0] + '.csv');
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
