# Gestoo - API Reference

## Overview

Gestoo uses Supabase Edge Functions as the primary API layer. All endpoints are serverless Deno functions deployed to Supabase's edge network.

**Base URL:** `https://your-project.supabase.co/functions/v1`

---

## Authentication

### For Client Applications

Most endpoints require a valid Supabase JWT token:

```bash
Authorization: Bearer <supabase-jwt-token>
```

### For Webhooks

Webhook endpoints use signature verification instead of JWT:
- Wave: `wave-signature` header
- Orange Money: `x-orange-signature` header

### For Service-to-Service

Use the Supabase service role key:

```bash
Authorization: Bearer <service-role-key>
apikey: <service-role-key>
```

---

## Edge Function Endpoints

### Generate License

Generates a unique license number for a property.

**Endpoint:** `POST /generate-license`

**Request:**

```json
{
  "property_id": "uuid"
}
```

**Response:**

```json
{
  "license_number": "TRG-2024-00001"
}
```

**cURL Example:**

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/generate-license' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "property_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | property_id is required |
| 404 | Property not found |
| 500 | Internal server error |

---

### Calculate TPT

Calculates the Tourist Promotion Tax for a stay.

**Endpoint:** `POST /calculate-tpt`

**Request:**

```json
{
  "stay_id": "uuid"
}
```

**Response:**

```json
{
  "tax_liability_id": "uuid",
  "amount": 5000,
  "nights": 5,
  "num_guests": 1,
  "rate_per_night": 1000
}
```

**cURL Example:**

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/calculate-tpt' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "stay_id": "550e8400-e29b-41d4-a716-446655440001"
  }'
```

**Calculation Formula:**

```
TPT = rate_per_night (1000 FCFA) x num_guests x nights
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | stay_id is required |
| 404 | Stay not found |
| 500 | Failed to create tax liability |

---

### Payment Webhook

Handles payment callbacks from Wave and Orange Money.

**Endpoint:** `POST /payment-webhook?provider={wave|orange_money}`

#### Wave Webhook

**Headers:**

```
wave-signature: <hmac-sha256-signature>
Content-Type: application/json
```

**Request (Wave):**

```json
{
  "event": "checkout.session.completed",
  "data": {
    "id": "wave-checkout-id",
    "client_reference": "payment-ref",
    "transaction_id": "wave-txn-id",
    "status": "completed",
    "amount": 5000,
    "currency": "XOF"
  }
}
```

#### Orange Money Webhook

**Headers:**

```
x-orange-signature: <hmac-sha256-signature>
Content-Type: application/json
```

**Request (Orange Money):**

```json
{
  "status": "SUCCESS",
  "txnid": "orange-txn-id",
  "notif_token": "notification-token",
  "data": {
    "amount": 5000,
    "currency": "XOF"
  }
}
```

**Response:**

```json
{
  "success": true
}
```

**cURL Example (Wave):**

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/payment-webhook?provider=wave' \
  -H 'wave-signature: <signature>' \
  -H 'Content-Type: application/json' \
  -d '{
    "event": "checkout.session.completed",
    "data": {
      "id": "checkout-123",
      "client_reference": "PAY-001",
      "status": "completed",
      "amount": 5000
    }
  }'
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Unknown provider |
| 401 | Invalid signature |
| 404 | Payment not found |
| 500 | Internal server error |

---

### Minor Alert

Creates or updates alerts for minor guests.

**Endpoint:** `POST /minor-alert`

**Request:**

```json
{
  "stay_id": "uuid",
  "action": "create"
}
```

**Response:**

```json
{
  "alert_id": "uuid",
  "severity": "critical",
  "age": 15,
  "has_guardian": false,
  "guardian_verified": false,
  "is_night_checkin": false
}
```

**Severity Levels:**

| Severity | Condition |
|----------|-----------|
| `critical` | Minor under 14 without verified guardian |
| `high` | Minor 14-17 without guardian, or night check-in |
| `medium` | Minor with unverified guardian |
| `low` | Minor with verified guardian (routine tracking) |

**cURL Example:**

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/minor-alert' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "stay_id": "550e8400-e29b-41d4-a716-446655440002"
  }'
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | stay_id is required |
| 404 | Stay not found |
| 500 | Internal server error |

---

### Generate Receipt

Generates a payment receipt in HTML format.

**Endpoint:** `POST /generate-receipt`

**Request:**

```json
{
  "payment_id": "uuid"
}
```

**Response:**

```json
{
  "receipt_number": "REC-2024-ABC123",
  "receipt_url": "https://storage.supabase.co/receipts/REC-2024-ABC123.html",
  "receipt_html": "<html>...</html>"
}
```

**cURL Example:**

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/generate-receipt' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "payment_id": "550e8400-e29b-41d4-a716-446655440003"
  }'
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | payment_id is required / Payment not completed |
| 404 | Payment not found / Related data not found |
| 500 | Internal server error |

---

## Chatbot Webhook

### Verify Webhook (WhatsApp)

**Endpoint:** `GET /webhook`

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| hub.mode | Must be "subscribe" |
| hub.verify_token | Your verification token |
| hub.challenge | Challenge string to return |

**Response:** Returns the `hub.challenge` value

---

### Receive Message (WhatsApp)

**Endpoint:** `POST /webhook`

**Request (WATI format):**

```json
{
  "id": "message-id",
  "waId": "221771234567",
  "senderName": "John Doe",
  "text": "Bonjour",
  "type": "text",
  "timestamp": "1704067200"
}
```

**Request (Meta format):**

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "business-id",
    "changes": [{
      "value": {
        "messages": [{
          "from": "221771234567",
          "id": "message-id",
          "timestamp": "1704067200",
          "type": "text",
          "text": {
            "body": "Bonjour"
          }
        }]
      }
    }]
  }]
}
```

**Response:**

```json
{
  "status": "ok"
}
```

---

## Supabase Direct API

### Authentication

#### Phone OTP Login

```bash
curl -X POST \
  'https://your-project.supabase.co/auth/v1/otp' \
  -H 'apikey: <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "+221771234567"
  }'
```

#### Verify OTP

```bash
curl -X POST \
  'https://your-project.supabase.co/auth/v1/verify' \
  -H 'apikey: <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "+221771234567",
    "token": "123456",
    "type": "sms"
  }'
```

### Database Queries

#### Get Landlord Profile

```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/landlords?select=*&user_id=eq.<user-id>' \
  -H 'Authorization: Bearer <token>' \
  -H 'apikey: <anon-key>'
```

#### Get Properties

```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/properties?select=*,property_photos(*)&landlord_id=eq.<landlord-id>' \
  -H 'Authorization: Bearer <token>' \
  -H 'apikey: <anon-key>'
```

#### Create Stay

```bash
curl -X POST \
  'https://your-project.supabase.co/rest/v1/stays' \
  -H 'Authorization: Bearer <token>' \
  -H 'apikey: <anon-key>' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -d '{
    "property_id": "<property-id>",
    "guest_id": "<guest-id>",
    "check_in": "2024-01-15T14:00:00Z",
    "num_guests": 2
  }'
```

#### Get Active Alerts (Admin)

```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/alerts?select=*,properties(name,address),guests(first_name,last_name)&status=eq.new&order=created_at.desc' \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'apikey: <anon-key>'
```

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Edge Functions | 500 requests/minute |
| Database API | 1000 requests/minute |
| Auth API | 100 requests/minute |
| Storage API | 100 requests/minute |

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## SDKs and Libraries

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Call Edge Function
const { data, error } = await supabase.functions.invoke('generate-license', {
  body: { property_id: 'uuid' }
});

// Query database
const { data: properties } = await supabase
  .from('properties')
  .select('*')
  .eq('landlord_id', landlordId);
```

### Python

```python
from supabase import create_client

supabase = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_KEY")
)

# Query database
response = supabase.table("properties").select("*").eq("status", "active").execute()
```

---

## Webhooks Configuration

### Wave Webhook URL
```
https://your-project.supabase.co/functions/v1/payment-webhook?provider=wave
```

### Orange Money Webhook URL
```
https://your-project.supabase.co/functions/v1/payment-webhook?provider=orange_money
```

### WhatsApp Webhook URL
```
https://your-chatbot-service.com/webhook
```
