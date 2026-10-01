# 💬 whatsapp-flow-router

> **Topics:** `whatsapp-cloud-api` `chatbot` `state-machine` `conversational-ai` `lead-qualification` `meta-api`


[![Release](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/MobileConduit/whatsapp-flow-router/releases/tag/v1.0.0)
[![CI/CD Pipeline](https://github.com/MobileConduit/whatsapp-flow-router/actions/workflows/ci.yml/badge.svg)](https://github.com/MobileConduit/whatsapp-flow-router/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-brightgreen.svg)](https://nodejs.org)
[![Platform: WhatsApp Cloud API](https://img.shields.io/badge/WhatsApp-Cloud%20API-25D366.svg?logo=whatsapp&logoColor=white)](https://developers.facebook.com)

A high-performance, deterministic state-machine conversational router for the **WhatsApp Cloud API**. Enables enterprise lead qualification, dynamic menu trees, multi-stage routing, and automated support workflows without proprietary vendor lock-in or costly subscription bot builders.

---

## 🚀 Key Features

- **Declarative YAML Workflow Engine**: Define conversational states, replies, and routing transitions cleanly in `workflow.yaml`.
- **Deterministic State Machine**: Robust session state tracking per user phone number with graceful fallback handling.
- **Zero-Dependency QR Code SVG Generator**: Instantly generate vector QR codes for WhatsApp *Click-to-Chat* (`https://wa.me/...`) links.
- **Meta Webhook Verification & Processing**: Fully compatible with Meta's challenge/response handshake and incoming message webhook payloads.
- **Automated Test Suite**: Native unit & integration tests using Node.js test runner (`node:test`).
- **Production-Ready CI/CD**: GitHub Actions workflow testing across Node.js 18.x, 20.x, and 22.x.

---

## 🔄 Architecture & Workflows

### 1. Conversational State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> INIT: Incoming Greeting / New Session
    
    INIT --> MAIN_MENU: Any Message / Welcome Prompt
    
    MAIN_MENU --> SALES_MENU: Reply "1" (Sales)
    MAIN_MENU --> TECH_SUPPORT: Reply "2" (Support)
    MAIN_MENU --> INIT: Reply "0" (Restart)
    
    SALES_MENU --> AWAITING_LEAD_INFO: Enter Company / Requirement
    SALES_MENU --> MAIN_MENU: Reply "0" (Back)
    
    AWAITING_LEAD_INFO --> INIT: Lead Stored / Confirmation Sent
    AWAITING_LEAD_INFO --> MAIN_MENU: Reply "0" (Back)
    
    TECH_SUPPORT --> SUPPORT_RESOLVED: Ticket Created / Issue Logged
    TECH_SUPPORT --> MAIN_MENU: Reply "0" (Back)
    
    SUPPORT_RESOLVED --> INIT: Session Reset
    SUPPORT_RESOLVED --> MAIN_MENU: Reply "0" (Back)
```

### 2. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 📱 WhatsApp User
    participant Meta as ☁️ Meta Cloud API
    participant Router as ⚡ whatsapp-flow-router (Express)
    participant Engine as 🧠 StateMachineEngine (YAML)
    participant DB as 💾 State Storage (Map / Cache)

    Customer->>Meta: Sends text message ("Hello")
    Meta->>Router: POST /webhook (JSON payload)
    Router->>DB: Query current state for user phone
    DB-->>Router: Return state (e.g. INIT or MAIN_MENU)
    Router->>Engine: transition(currentState, userMessage)
    Engine->>Engine: Match transition in workflow.yaml
    Engine-->>Router: Return { nextState, reply }
    Router->>DB: Update state for user phone
    Router-->>Meta: 200 OK (Webhook Ack)
    Router->>Meta: (Optional) Send reply via WhatsApp Graph API
    Meta-->>Customer: Display conversational reply
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/MobileConduit/whatsapp-flow-router.git
cd whatsapp-flow-router

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

### Configuration (`.env.example`)

```env
PORT=8000
VERIFY_TOKEN=MY_VERIFY_TOKEN
WHATSAPP_TOKEN=your_meta_access_token_here
PHONE_NUMBER_ID=your_phone_number_id_here
WORKFLOW_FILE=workflow.yaml
WHATSAPP_BUSINESS_PHONE=+963934005922
```

### Running the Server

```bash
npm start
```

### Generating WhatsApp Onboarding QR Codes

Generate an SVG QR code pointing directly to your WhatsApp business chat with a pre-filled greeting:

```bash
# CLI execution
node qr-generator.js --phone +963934005922 --text "Hello Shadi, I'm inquiring about enterprise architecture." --output onboarding_qr.svg

# Or fetch dynamically from the running server:
# http://localhost:8000/qr.svg?phone=+963934005922&message=Hello
```

### Running Automated Tests

```bash
npm test
```

---

## 👤 Author & Maintainer

**Eng. MHD. Shadi AL-Hasan**  
- **Role:** Executive CTO & Enterprise Solutions Architect  
- **Email:** [mhd.shadi.alhasan@gmail.com](mailto:mhd.shadi.alhasan@gmail.com)  
- **Phone / WhatsApp:** [+963934005922](tel:+963934005922)  
- **Location:** Damascus, Syria  
- **GitHub:** [MobileConduit](https://github.com/MobileConduit)  

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.  
Copyright (c) 2026 **MHD. Shadi AL-Hasan**. All rights reserved.