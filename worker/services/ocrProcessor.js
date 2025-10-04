import Tesseract from 'tesseract.js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const CURRENT_DATE = new Date().toISOString().slice(0, 10); // e.g., "2025-10-04"
const TIMEZONE = 'Asia/Kolkata';


const queryAI = async (messages, model = 'llama-3.1-8b-instant') => {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages,
            model,
            response_format: { type: 'json_object' },
        });

        const responseText = chatCompletion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error('AI returned an empty response.');
        }

        console.log('AI Response:', responseText);
        return JSON.parse(responseText);
    } catch (error) {
        console.error('error connection to AI:', error);
        throw new Error('AI resonse is not valid json.');
    }
};

// performing ocr on an image buffer
export const performOCR = async (imageBuffer) => {
    console.log('step 1 => starting ocr processing !!...');
    const { data } = await Tesseract.recognize(imageBuffer, 'eng');

    if (!data.text || data.text.trim().length === 0) {
        throw new Error('ocr cant find any text in the image provided !!..');
    }

    const result = {
        raw_text: data.text.trim(),
        confidence: data.confidence / 100, // Normalize to 0-1 scale
    };
    console.log('step 1 => ocr successful.', result);
    return result;
};

// entities extraction from raw text
export const extractEntities = async (text) => {
    console.log('step 2: => starting entity extraction !!...');
    const messages = [
        {
            role: 'system',
            content: `
              You are an expert entity extraction system. From the user's text, extract the raw phrases for the appointment department, date, and time.
              - "date_phrase": The exact words used for the date (e.g., "next Friday", "tomorrow", "sep 25th").
              - "time_phrase": The exact words used for the time (e.g., "3 pm", "noon", "at 4").
              - "department": The requested department (e.g., "dentist", "cardiology").
              - "confidence": Your confidence in the extraction from 0.0 to 1.0.
              Respond ONLY with a single, valid JSON object with these keys. If a value is not found, use null.
            `,
        },
        { role: 'user', content: text },
    ];

    const result = await queryAI(messages);
    console.log('step 2 => entity extraction successful. !!..', result);
    return { entities: result }; // nest result inside entities as per the problem statement
};



// normalize the extracted date and time entities
 export const normalizeEntities = async (entities) => {
     console.log('step 3 => starting entity normalizaton !!.. ');
     const { date_phrase, time_phrase } = entities;

     const messages = [
         {
             role: 'system',
             content: `
               You are an expert date and time normalization system.
               - The current date is ${CURRENT_DATE}. The target timezone is "${TIMEZONE}".
               - Convert the user's date phrase into a strict "YYYY-MM-DD" format. Do NOT include any time information in the date field.
               - Convert the user's time phrase into a strict "HH:mm" (24-hour) format.
               - "confidence": Your confidence in the normalization from 0.0 to 1.0.
               Respond ONLY with a single, valid JSON object with keys "date", "time", and "confidence". If a value cannot be normalized, use null.
             `,
         },
         { role: 'user', content: `Date Phrase: "${date_phrase}", Time Phrase: "${time_phrase}"` },
     ];

     const result = await queryAI(messages);
     console.log('step 3 => normalization successful.', result);
     return { normalized: { ...result, tz: TIMEZONE } };
 };


 // applying guardrails as given in problem statement
 export const applyGuardrailsAndFinalize = (entities, normalized) => {
     console.log('step 4 => applying guardrails !!...');
     const { department, confidence: entityConfidence } = entities;
     const { date, time, confidence: normConfidence } = normalized;

     if (!department || !date || entityConfidence < 0.7 || normConfidence < 0.7) {
         console.log('step 4 => guardrail rule triggered. need more clarification !!...');
         return {
             status: 'needs_clarification',
             message: 'Ambiguous or missing date or department.',
         };
     }

     const departmentMap = {
         dentist: 'Dentistry',
         cardiology: 'Cardiology',
         'heart doctor': 'Cardiology',
     };
     const finalDepartment = departmentMap[department.toLowerCase()] || department;

     const finalAppointment = {
         appointment: {
             department: finalDepartment,
             date: date,
             // db has not null condition setting here default time 9:00AM because if normalized time is null then it will crash backend
             time: time || '09:00:00',
             tz: TIMEZONE,
         },
         status: 'ok',
     };

     console.log('step 4 => final appointment JSON created.', finalAppointment);
     return finalAppointment;
 };
