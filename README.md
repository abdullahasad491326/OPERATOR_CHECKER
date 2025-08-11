# 💻 SMS & SIM Tools Dashboard

A versatile Node.js web application designed to offer a suite of web tools for managing and querying telecom-related data, along with a secure, IP-based access control system.

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js Badge">
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js Badge">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License Badge">
</div>

---

### Table of Contents

-   [Features](#-features)
-   [Prerequisites](#-prerequisites)
-   [Installation & Setup](#-installation--setup)
-   [Configuration](#-configuration)
-   [API Endpoints](#-api-endpoints)
-   [Usage](#-usage)
-   [File Structure](#-file-structure)
-   [Important Note on SMS Functionality](#-important-note-on-sms-functionality)
-   [License](#-license)

---

### 🚀 Features

-   **Admin Dashboard:** A password-protected web interface to manage service settings.
-   **IP Access Control:** Dynamically block and unblock specific IP addresses to control who can access the service.
-   **Simulated SMS Service:** An internal-only API endpoint that logs SMS message attempts and tracks usage without integrating with a real SMS gateway.
-   **SIM Data Lookup:** An endpoint to fetch owner details (name, CNIC, address) from a third-party service based on a mobile number.
-   **Mobile Operator Check:** A proxy endpoint to query a third-party service for the mobile network operator of a given number.

---

### 📋 Prerequisites

-   **Node.js**: [Download & Install](https://nodejs.org/)
-   **npm**: Included with Node.js

---

### 🔧 Installation & Setup

1.  **Set up the project structure:**
    Create a project folder, then place your `server.js` file inside. Create a `public` subfolder and place `admin.html` and `Operator.html` within it.

    ```
    /your-project-folder/
    ├── server.js
    └── /public/
        ├── Operator.html
        └── admin.html
    ```

2.  **Install project dependencies:**
    Navigate to your project directory in the terminal and run the following command to install all necessary packages:
    ```bash
    npm install express express-session node-fetch jsdom
    ```

---

### ⚙️ Configuration

-   **Admin Credentials:**
    Modify the `ADMIN_USERNAME` and `ADMIN_PASSWORD` constants in `server.js` to secure your admin dashboard.
    ```javascript
    const ADMIN_USERNAME = 'PAKCYBER';
    const ADMIN_PASSWORD = '24113576';
    ```

---

### 🖥️ API Endpoints

| Method | Path                | Description                                                                    |
|--------|---------------------|--------------------------------------------------------------------------------|
| `GET`  | `/`                 | Serves the main `Operator.html` page.                                          |
| `GET`  | `/admin`            | Serves the `admin.html` login page.                                            |
| `POST` | `/admin/login`      | Authenticates admin users with a username and password.                        |
| `GET`  | `/proxy`            | Checks the mobile network operator for a given number.                         |
| `POST` | `/sim-search`       | Searches for SIM owner data based on a mobile number.                          |
| `POST` | `/send-sms`         | Logs a message and simulates an SMS send (no external API call).               |
| `GET`  | `/api/admin/logs`   | **(Protected)** Retrieves all logged SMS messages.                             |
| `GET`  | `/api/admin/stats`  | **(Protected)** Retrieves statistics on message logs and visitors.             |
| `GET`  | `/api/admin/status` | **(Protected)** Retrieves the current status of the SMS service.               |
| `POST` | `/api/admin/toggle-sms` | **(Protected)** Toggles the service status (ON/OFF).                      |
| `GET`  | `/api/admin/blocked-ips` | **(Protected)** Retrieves a list of all blocked IPs.                     |
| `POST` | `/api/admin/block-ip` | **(Protected)** Adds an IP address to the blocked list.                      |
| `POST` | `/api/admin/unblock-ip` | **(Protected)** Removes an IP address from the blocked list.                 |


---

### ➡️ Usage

1.  **Start the Server:**
    Run the following command in your terminal from the project's root directory:
    ```bash
    node server.js
    ```
    The server will be available at `http://localhost:10000`.

2.  **Access the Web Interface:**
    -   **Operator Tools:** Navigate to `http://localhost:10000` to access the front-end tools.
    -   **Admin Panel:** Navigate to `http://localhost:10000/admin` to log in and manage the service.

---

### 📝 Important Note on SMS Functionality

The `/send-sms` endpoint is designed to be a mock service. It logs messages to an in-memory array on the server for tracking purposes but **does not** connect to any real SMS gateway. This behavior is intentional, as per the project's requirements, to avoid external dependencies while still providing a log of attempted sends.

---

### 📜 License

This project is licensed under the **MIT License**.
