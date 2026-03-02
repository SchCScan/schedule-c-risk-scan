const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const CLIENTS_TABLE = process.env.AIRTABLE_CLIENTS_TABLE || 'Clients';
  const ASSESSMENTS_TABLE = process.env.AIRTABLE_ASSESSMENTS_TABLE || 'Risk Assessments';

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error: Missing Airtable credentials' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      firstName,
      lastName,
      email,
      businessName,
      businessType,
      yearsInBusiness,
      rawScore,
      maxPossibleScore,
      convertedScore,
      stage,
      recommendedRoute,
      riskLevel
    } = data;

    if (!email || !firstName || !lastName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: email, firstName, lastName' })
      };
    }

    const headers = {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(CLIENTS_TABLE)}?filterByFormula={Email}="${email}"`;
    
    const searchResponse = await fetch(searchUrl, { headers });
    const searchResult = await searchResponse.json();

    if (!searchResponse.ok) {
      throw new Error(`Airtable search failed: ${searchResult.error?.message || 'Unknown error'}`);
    }

    let clientId;

    if (searchResult.records && searchResult.records.length > 0) {
      clientId = searchResult.records[0].id;
    } else {
      const createClientUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(CLIENTS_TABLE)}`;
      
      const clientPayload = {
        fields: {
          'First Name': firstName,
          'Last Name': lastName,
          'Email': email,
          'Business Name': businessName,
          'Business Type': businessType,
          'Years in Business': yearsInBusiness
        }
      };

      const createClientResponse = await fetch(createClientUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(clientPayload)
      });

      const createClientResult = await createClientResponse.json();

      if (!createClientResponse.ok) {
        throw new Error(`Failed to create client: ${createClientResult.error?.message || 'Unknown error'}`);
      }

      clientId = createClientResult.id;
    }

    const createAssessmentUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(ASSESSMENTS_TABLE)}`;
    
    const assessmentPayload = {
      fields: {
        'Client': [clientId],
        'First Name': firstName,
        'Last Name': lastName,
        'Email': email,
        'Business Name': businessName,
        'Business Type': businessType,
        'Years in Business': yearsInBusiness,
        'Raw Score': rawScore,
        'Max Possible Score': maxPossibleScore,
        'Converted Score': convertedScore,
        'Stage': stage,
        'Recommended Route': recommendedRoute,
        'Risk Level': riskLevel,
        'Assessment Date': new Date().toISOString()
      }
    };

    const createAssessmentResponse = await fetch(createAssessmentUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(assessmentPayload)
    });

    const createAssessmentResult = await createAssessmentResponse.json();

    if (!createAssessmentResponse.ok) {
      throw new Error(`Failed to create assessment: ${createAssessmentResult.error?.message || 'Unknown error'}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ok: true,
        message: 'Assessment submitted successfully',
        clientId: clientId,
        assessmentId: createAssessmentResult.id
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message || 'An error occurred while processing your submission'
      })
    };
  }
};
