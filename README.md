# 💻 SMS & SIM Tools Dashboard

A versatile Node.js web application designed to offer a suite of web tools for managing and querying telecom-related data, along with a secure, IP-based access control system.

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js Badge">
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js Badge">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License Badge">
</div>

---

### Table of Contents

-   [Getting Started](#-getting-started)
-   [Features](#-features)
-   [Prerequisites](#-prerequisites)
-   [Installation](#-installation)
-   [Configuration](#-configuration)
-   [API Endpoints](#-api-endpoints)
-   [Usage](#-usage)
-   [File Structure](#-file-structure)
-   [Important Note on SMS Functionality](#-important-note-on-sms-functionality)
-   [License](#-license)

---

### 🚀 Getting Started

Follow these steps to quickly get the application up and running.

1.  **Install Dependencies:** Run `npm install` in your project folder.
2.  **Configure Admin Credentials:** Set your `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `server.js` or using environment variables.
3.  **Start the Server:** Execute `node server.js` to launch the application.

---

### ✨ Features

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

### 🔧 Installation

1.  **Project Structure:**
    Ensure your project folder contains a `server.js` file and a `public` directory with `admin.html` and `Operator.html` inside it.

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
    The application's admin credentials are set in the `server.js` file. For a production environment, it is highly recommended to use environment variables for sensitive information.

    **Method 1: Direct File Modification**
    Open `server.js` and modify the values for `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

    ```javascript
    // Change these values to your desired username and password
    const ADMIN_USERNAME = 'your-secure-username';
    const ADMIN_PASSWORD = 'your-secure-password';
    ```

    **Method 2: Using Environment Variables (Recommended)**
    To avoid hardcoding credentials, you can use environment variables. Create a `.env` file in your project's root directory and add your credentials there. Then, modify `server.js` to read from these variables.

    `.env` file:
    ```
    ADMIN_USERNAME='your-secure-username'
    ADMIN_PASSWORD='your-secure-password'
    ```

    `server.js` file:
    ```javascript
    // Use an environment variable, falling back to a default if not set
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'default_user';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';
    ```
    *(Note: This method requires installing the `dotenv` package with `npm install dotenv` and adding `require('dotenv').config()` at the top of your `server.js` file.)*

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
