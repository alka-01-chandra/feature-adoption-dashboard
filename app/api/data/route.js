import { fetchSheetData, getSchemaInfo } from '../../../lib/sheets';
import { analyzeData, filterByDateRange, filterByBrandType } from '../../../lib/analytics';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'category';
    const brandType = searchParams.get('brandType') || 'All';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const refresh = searchParams.get('refresh') === 'true';
    
    // Fetch raw data from Google Sheets
    const { category, subcategory, fromCache, lastFetch } = await fetchSheetData(refresh);
    
    // Select the right dataset based on mode
    let rawData = mode === 'subcategory' ? subcategory : category;
    
    // If subcategory data is empty, fall back to category
    if (!rawData || !rawData.length) {
      rawData = category;
    }
    
    if (!rawData || !rawData.length) {
      return Response.json({
        error: 'No data available. Check that the Google Sheet is accessible.',
        schema: null,
        analysis: null,
      }, { status: 404 });
    }
    
    // Apply filters
    let filtered = filterByDateRange(rawData, startDate, endDate);
    filtered = filterByBrandType(filtered, brandType);
    
    // Get schema info from unfiltered data for UI metadata
    const schemaCategory = getSchemaInfo(category);
    const schemaSubcategory = getSchemaInfo(subcategory);
    
    // Run analysis
    const analysis = analyzeData(filtered, mode);
    
    return Response.json({
      analysis,
      schema: {
        category: schemaCategory,
        subcategory: schemaSubcategory,
        columns: Object.keys(rawData[0] || {}),
        totalRows: rawData.length,
      },
      meta: {
        mode,
        brandType,
        startDate,
        endDate,
        fromCache,
        lastFetch: new Date(lastFetch).toISOString(),
        hasSubcategoryData: subcategory && subcategory.length > 0,
      },
    });
  } catch (err) {
    console.error('API Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
