
# Assignment 5 

**Focus Area:** OCR -> Entity Extraction -> Normalization

  
**Problem Statement:**

Build a backend service that parses natural language or document-based appointment requests and converts them into structured scheduling data. The system should handle both typed text and noisy image inputs (e.g., scanned notes, emails). Interns must design a pipeline with OCR, entity extraction, normalization, and final structured JSON output with guardrails for ambiguity.

  
**Step 1 - OCR/Text Extraction**

Handle typed requests or photos of notes/emails.

Input (text):

Book dentist next Friday at 3pm

  
Input (image -> OCR sample):

book dentist nxt Friday @ 3 pm

  
Expected Output (JSON):

```json
{

  "raw_text": "Book dentist next Friday at 3pm",

 "confidence": 0.90

}
```

  

**Step 2 - Entity Extraction**

Extract date/time phrase and department.

Expected Output (JSON):

```json
{

 "entities": {  
  "date_phrase": "next Friday",  
  "time_phrase": "3pm",  
  "department": "dentist"  
},

  "entities_confidence": 0.85  
}
```

**Step 3 - Normalization (Asia/Kolkata)**

Map phrases to ISO date/time in local timezone.

Expected Output (JSON):

```json
{

   "normalized": {  
    "date": "2025-09-26",  
    "time": "15:00",  
    "tz": "Asia/Kolkata"

  },

  "normalization_confidence": 0.90  
}
```

  

**Guardrail / Exit Condition (JSON):**

```json
{"status":"needs_clarification","message":"Ambiguous date/time or department"}
```

  

**Step 4 - Final Appointment JSON**

Combine entities and normalized values.

Expected Output (JSON):

```json
{

  "appointment": {  
    "department": "Dentistry",  
  "date": "2025-09-26",  
  "time": "15:00",  
  "tz": "Asia/Kolkata"

 },  
"status":"ok"

}
```

---

# Project Design


### Component Breakdown

1. **API Server (`api-server`)**:
    
    - **Technology**: Express.js 
        
    - **Responsibility**: This is the public-facing entry point. Its only jobs are to accept incoming HTTP requests, perform basic validation, create a unique job ID, and push a job onto the message queue. It immediately responds to the client with a `202 Accepted` status and the `jobId`, without waiting for the processing to finish.
        
2. **Worker (`worker`)**:
    
    - **Technology**: Node.js
        
    - **Responsibility**: This is the background processing engine. It continuously listens for new jobs on the message queue. When a job arrives, the worker executes the entire AI pipeline: downloading the image from S3 (if necessary), performing OCR, making chained calls to the AI for extraction and normalization, applying guardrails, and finally saving the valid appointment to the PostgreSQL database. Throughout its process, it updates the job's status in Redis.
        
3. **RabbitMQ (Message Queue)**:
    
    - **Responsibility**: Acts as the central message broker between the API Server and the Worker. This decoupling is critical:
        
        - **Resilience**: If the Worker crashes, the job remains safely in the queue, ready to be processed when the Worker restarts.
            
        - **Scalability**: We can easily add more Worker instances to consume jobs in parallel and handle a higher load without changing the API Server.
            
4. **Redis (Status Store & Cache)**:
    
    - **Responsibility**: A fast in-memory key-value store used to track the status of each job. When a job is created, its status is `pending`. The Worker updates it to `processing`, and finally to `completed` or `failed`. The API Server's `/status/:jobId` endpoint reads directly from Redis to provide instant updates to the client.
        
5. **PostgreSQL (Database)**:
    
    - **Responsibility**: The permanent, persistent storage for the final, structured appointment data. Only valid, fully processed appointments are saved here.
        
6. **AWS S3 (Object Storage)**:
    
    - **Responsibility**: Used to store the uploaded image files. The API server uploads the file and passes the S3 object key to the worker via the job payload.


### Data & Process Flow

end-to-end flow of a request:
[![](https://mermaid.ink/img/pako:eNqVVdtu4jAQ_ZWRX0oloOFamodKCLoV3aWlpVW1K15MMoB3Ezu1nV7Vf9_JjdAle8sDIuM5PmfOjJ035ikfmcsMPsQoPRwLvtY8XEigJ-LaCk9EXFoYBQKl3Y8PZxOYo35EXbF2P4d5Zz9-g74wFWG-XAo7vd5fuVf6RxXBuVYPMJzsL8yUsWuN8-svC5mtZvobp6elYBdmV_NbODLeBv04QKg9CbsBEfI1Hll8tocZtEQk8LQmF-6iQHE_S4aaWEGk1aPw0a8CpQW7MNLILcJ3tYSasdzGFItQ-kKuK1G5H6QzXgbCbFJkiMYknKnWCwpMxntYAmf1utB22jD0PIws-lDTaGMtTY47LMy5VCRLEXLbg3pmuZtbD8IAKbAoSSuslE6kmGazmeELFPEWuJGSJg5xV3KWmyWUptxFfmFK5glYBQfkpkcoYjsoRPLAwiS1m9RnoQ_7FZ0ZqydZ9qYisZA4Q02VhHA1usmyqBUF2TY5HzEXWk04e7aaexbOpBVWoIFaIv3ICqoz2mhuMG9jDmrskN2kzoPmT0STwX_H1G5SQ3TIA_GKO1xf6WlMp43x-K8ssoD7sFW4V1mBGUZR8ALnMde-5iIwpdtlDGbcmAory3PmwuRyfnZzCzyKlJA2pCoTcl6iyuQqyfj0AVpM9b-PjKfCKEAa84PsbGg0cWBz1RgY3K3nE_3-L8GKMNvdUWul98YmUCqiOoMgPSMZtqSpvIPOz5IrKM08colx4peAqkvkHG0qLPE2Zdl1Ks1p_MKQO7xTDZf-R3v-dH84cPU5vxpXQvIALuZXl4fb0lmdrbXwmWt1jHUWIo1e8srekpQFsxuk4WMu_fVxxYlzwRbynWB0U39TKiyQWsXrDXNXnFpVZ3HagvxztE0hPtQjFUvL3HYn3YK5b-yZuf1Bs93tD066g06_2-4dD-rshbm9XrPvdJ2BQ2W0Tnqd1nudvaacrWav1245jnPccbonTr_frzMyzyo9zb6I6Yfx_SdCaU1o?type=png)](https://mermaid.live/edit#pako:eNqVVdtu4jAQ_ZWRX0oloOFamodKCLoV3aWlpVW1K15MMoB3Ezu1nV7Vf9_JjdAle8sDIuM5PmfOjJ035ikfmcsMPsQoPRwLvtY8XEigJ-LaCk9EXFoYBQKl3Y8PZxOYo35EXbF2P4d5Zz9-g74wFWG-XAo7vd5fuVf6RxXBuVYPMJzsL8yUsWuN8-svC5mtZvobp6elYBdmV_NbODLeBv04QKg9CbsBEfI1Hll8tocZtEQk8LQmF-6iQHE_S4aaWEGk1aPw0a8CpQW7MNLILcJ3tYSasdzGFItQ-kKuK1G5H6QzXgbCbFJkiMYknKnWCwpMxntYAmf1utB22jD0PIws-lDTaGMtTY47LMy5VCRLEXLbg3pmuZtbD8IAKbAoSSuslE6kmGazmeELFPEWuJGSJg5xV3KWmyWUptxFfmFK5glYBQfkpkcoYjsoRPLAwiS1m9RnoQ_7FZ0ZqydZ9qYisZA4Q02VhHA1usmyqBUF2TY5HzEXWk04e7aaexbOpBVWoIFaIv3ICqoz2mhuMG9jDmrskN2kzoPmT0STwX_H1G5SQ3TIA_GKO1xf6WlMp43x-K8ssoD7sFW4V1mBGUZR8ALnMde-5iIwpdtlDGbcmAory3PmwuRyfnZzCzyKlJA2pCoTcl6iyuQqyfj0AVpM9b-PjKfCKEAa84PsbGg0cWBz1RgY3K3nE_3-L8GKMNvdUWul98YmUCqiOoMgPSMZtqSpvIPOz5IrKM08colx4peAqkvkHG0qLPE2Zdl1Ks1p_MKQO7xTDZf-R3v-dH84cPU5vxpXQvIALuZXl4fb0lmdrbXwmWt1jHUWIo1e8srekpQFsxuk4WMu_fVxxYlzwRbynWB0U39TKiyQWsXrDXNXnFpVZ3HagvxztE0hPtQjFUvL3HYn3YK5b-yZuf1Bs93tD066g06_2-4dD-rshbm9XrPvdJ2BQ2W0Tnqd1nudvaacrWav1245jnPccbonTr_frzMyzyo9zb6I6Yfx_SdCaU1o)

---

# Tech Stack used

- **Backend**: Node.js, Express.js
    
- **Database**: PostgreSQL
    
- **Cache & Job Store**: Redis
    
- **Message Broker**: RabbitMQ
    
- **AI/LLM**: Groq SDK (for Llama 3.1)
    
- **OCR**: Tesseract.js
    
- **File Storage**: AWS S3
    
- **Containerization**: Docker & Docker Compose


---

# how to get project running

Follow these instructions to get the project running locally.

### Prerequisites

- Node.js (v18+) and npm
    
- Docker and Docker Compose
    
- Git
    
- An AWS account with an S3 bucket and IAM credentials (`accessKeyId`, `secretAccessKey`).
    
- A Groq AI API Key.


### 1. Clone the Repository


```bash
git clone <copy repo link from above>
cd plum_assignment5
```

### 2. Configure Environment Variables

You need to create a `.env` file in both the `api-server` and `worker` directories.

**In `api-server/.env.example`, create `api-server/.env`:**

Code snippet

```
PORT=3000
RABBITMQ_URL=amqp://your_mq_user:your_mq_password@localhost:5672
REDIS_URL=redis://localhost:6379

# AWS Credentials for S3 Upload
AWS_REGION=your-aws-region
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_NAME=your-s3-bucket-name
```

**In `worker/.env.example`, create `worker/.env`:**

Code snippet

```
RABBITMQ_URL=amqp://your_mq_user:your_mq_password@localhost:5672
REDIS_URL=redis://localhost:6379

# PostgreSQL Connection
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_db_user
PG_PASSWORD=your_db_password
PG_DATABASE=appointments_db

# AWS Credentials for S3 Download
AWS_REGION=your-aws-region
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_NAME=your-s3-bucket-name

# Groq AI API Key
GROQ_API_KEY=your-groq-api-key
```

_Note: The user/passwords for RabbitMQ and Postgres should match the values in `docker-compose.yml`. otheriwse backend services may not connect to docker container running redis and RabbitMQ_

### 3. Install Dependencies

Install dependencies for both workspaces from the root directory.


```bash
npm install
```

### 4. Start Dependent Services

Use Docker Compose to start PostgreSQL, Redis, and RabbitMQ.


```bash
docker-compose up -d
```

### 5. Run the Application

Run the API server and the Worker in parallel from the root directory.


```bash
npm run dev
```

logs will be visible on the terminal now.

---

# API Usage & design

### 1. Schedule an Appointment

**Endpoint**: `POST /api/v1/schedule`

This endpoint accepts both text and image requests.

#### Example: Text Request (cURL)


```bash
curl --location 'http://localhost:3000/api/v1/schedule' \
--header 'Content-Type: application/json' \
--data '{
    "text": "Book an appointment for Cardiology on November 15th at 2:30 PM"
}'
```

#### Example: Image Request (cURL)

_Create an image file named `note.png` with appointment text inside it._


```bash
curl --location 'http://localhost:3000/api/v1/schedule' \
--form 'image=@"/path/to/your/note.png"'
```

#### Success Response (202 Accepted)

Both requests will immediately return a `jobId`:


```json
{
    "message": "request isbeing processed {inside queue}",
    "jobId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
}
```

### 2. Check Job Status

**Endpoint**: `GET /api/v1/status/:jobId`

Use the `jobId` from the previous step to poll this endpoint.

#### Example: Status Request (cURL)


```json
curl http://localhost:3000/api/v1/status/a1b2c3d4-e5f6-7890-1234-567890abcdef
```

#### Final Response: Completed (200 OK)

```json
{
    "status": "completed",
    "inputType": "text",
    "rawText": "Book an appointment for Cardiology on November 15th at 2:30 PM",
    "createdAt": "...",
    "updatedAt": "...",
    "step1_ocr_text": "...",
    "step2_entity_department": "Cardiology",
    "step2_entity_date_phrase": "November 15th",
    "step2_entity_time_phrase": "2:30 PM",
    "step3_normalized_date": "2025-11-15",
    "step3_normalized_time": "14:30",
    "appointmentId": "f0e9d8c7-...",
    "result_department": "Cardiology",
    "result_date": "2025-11-15",
    "result_time": "14:30"
}
```

#### Final Response: Failed (200 OK)


```json
{
    "status": "failed",
    "inputType": "text",
    "rawText": "appointment doctor",
    "createdAt": "...",
    "updatedAt": "...",
    "errorMessage": "Ambiguous or missing date or department."
}
```
