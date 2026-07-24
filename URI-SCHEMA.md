# เอกสาร URI Schema - student-api (สัปดาห์ที่ 3)

เอกสารฉบับนี้จัดทำขึ้นเพื่อระบุและบันทึกข้อกำหนด **URI Schema**, **HTTP Methods**, และ **Status Codes** ของ API ระบบจัดการข้อมูลนักศึกษา (`student-api`) ตามมาตรฐาน RESTful Web API

---

## 1. ตาราง URI Schema ทั้งหมด (URI Schema Table)

| Method | URI | คำอธิบาย | Status Code ที่เป็นไปได้ | Safe | Idempotent |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **GET** | `/api/v1/students` | ดึงรายการนักศึกษาทั้งหมด | `200 OK` | Yes | Yes |
| **GET** | `/api/v1/students/{id}` | ดึงข้อมูลนักศึกษารายบุคคล (รองรับ `?include=courses`) | `200 OK`, `404 Not Found` | Yes | Yes |
| **POST** | `/api/v1/students` | เพิ่มนักศึกษาใหม่ | `201 Created`, `400 Bad Request`, `409 Conflict` | No | No |
| **PUT** | `/api/v1/students/{id}` | แก้ไขข้อมูลนักศึกษาทั้งระเบียน (Full Update) | `200 OK`, `400 Bad Request`, `404 Not Found` | No | Yes |
| **PATCH** | `/api/v1/students/{id}` | แก้ไขข้อมูลนักศึกษาบางส่วน (Partial Update) | `200 OK`, `404 Not Found` | No | No |
| **DELETE** | `/api/v1/students/{id}` | ลบข้อมูลนักศึกษา | `200 OK`, `404 Not Found` | No | Yes |

---

## 2. รายละเอียด Endpoint และตัวอย่างการใช้งาน (Endpoint Details)

### 2.1 GET `/api/v1/students`
- **คำอธิบาย:** เรียกดูข้อมูลนักศึกษาทั้งหมดในระบบ
- **Status Code:** `200 OK`
- **Response Body Example:**
```json
{
  "message": "สำเร็จ",
  "data": [
    {
      "id": 1,
      "name": "สมชาย ใจดี",
      "major": "วิทยาการคอมพิวเตอร์",
      "email": "somchai@example.com",
      "phone": "080-000-0001",
      "courseIds": [101, 102]
    },
    {
      "id": 2,
      "name": "สมหญิง รักเรียน",
      "major": "เทคโนโลยีสารสนเทศ",
      "email": "somying@example.com",
      "phone": "080-000-0002",
      "courseIds": [102]
    }
  ]
}
```

---

### 2.2 GET `/api/v1/students/{id}`
- **คำอธิบาย:** เรียกดูข้อมูลนักศึกษารายบุคคล โดยสามารถส่ง Query Parameter `?include=courses` เพื่อแนบรายชื่อวิชาที่ลงทะเบียน
- **Query Parameters:**
  - `include=courses` (Optional): ฝังข้อมูลรายวิชาที่นักศึกษาลงทะเบียนในฟิลด์ `courses`
- **Status Codes:**
  - `200 OK`: ดึงข้อมูลสำเร็จ
  - `404 Not Found`: ไม่พบข้อมูลนักศึกษาที่มี ID ตรงกับที่ระบุ
- **Request Example:** `GET /api/v1/students/1?include=courses`
- **Response Body Example (200 OK):**
```json
{
  "message": "สำเร็จ",
  "data": {
    "id": 1,
    "name": "สมชาย ใจดี",
    "major": "วิทยาการคอมพิวเตอร์",
    "email": "somchai@example.com",
    "phone": "080-000-0001",
    "courseIds": [101, 102],
    "courses": [
      {
        "id": 101,
        "courseName": "การเขียนโปรแกรมเบื้องต้น",
        "credit": 3
      },
      {
        "id": 102,
        "courseName": "โครงสร้างข้อมูล",
        "credit": 3
      }
    ]
  }
}
```
- **Response Body Example (404 Not Found):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "ไม่พบข้อมูลนักศึกษา"
  }
}
```

---

### 2.3 POST `/api/v1/students`
- **คำอธิบาย:** เพิ่มข้อมูลนักศึกษาใหม่เข้าสู่ระบบ
- **Headers:** `Content-Type: application/json`
- **Request Body Example:**
```json
{
  "name": "วิชัย ตั้งใจเรียน",
  "major": "วิศวกรรมซอฟต์แวร์",
  "email": "wichai@example.com",
  "phone": "080-000-0003"
}
```
- **Status Codes:**
  - `201 Created`: เพิ่มข้อมูลนักศึกษาใหม่สำเร็จ
  - `400 Bad Request`: ข้อมูลไม่ครบถ้วน (ขาด `name`, `major` หรือ `email`)
  - `409 Conflict`: อีเมลซ้ำกับที่มีอยู่ในระบบแล้ว
- **Response Example (201 Created):**
```json
{
  "message": "เพิ่มข้อมูลสำเร็จ",
  "data": {
    "id": 3,
    "name": "วิชัย ตั้งใจเรียน",
    "major": "วิศวกรรมซอฟต์แวร์",
    "email": "wichai@example.com",
    "phone": "080-000-0003",
    "courseIds": []
  }
}
```
- **Response Example (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "กรุณาระบุ name, major และ email ให้ครบถ้วน"
  }
}
```
- **Response Example (409 Conflict):**
```json
{
  "error": {
    "code": "DUPLICATE_EMAIL",
    "message": "อีเมลนี้มีอยู่ในระบบแล้ว"
  }
}
```

---

### 2.4 PUT `/api/v1/students/{id}`
- **คำอธิบาย:** แก้ไขข้อมูลนักศึกษาทั้งระเบียน (Full Update)
- **Headers:** `Content-Type: application/json`
- **Request Body Example:**
```json
{
  "name": "สมชาย ใจดีมาก",
  "major": "วิทยาการคอมพิวเตอร์และปัญญาประดิษฐ์",
  "email": "somchai.new@example.com",
  "phone": "080-999-9999"
}
```
- **Status Codes:**
  - `200 OK`: แก้ไขข้อมูลสำเร็จ
  - `400 Bad Request`: ข้อมูลที่ต้องระบุไม่ครบถ้วน
  - `404 Not Found`: ไม่พบ ID นักศึกษาที่ต้องการแก้ไข

---

### 2.5 PATCH `/api/v1/students/{id}`
- **คำอธิบาย:** แก้ไขข้อมูลนักศึกษาเฉพาะบางฟิลด์ (Partial Update)
- **Headers:** `Content-Type: application/json`
- **Request Body Example:**
```json
{
  "major": "ปัญญาประดิษฐ์"
}
```
- **Status Codes:**
  - `200 OK`: แก้ไขข้อมูลสำเร็จเฉพาะฟิลด์ที่ส่งมา (ฟิลด์อื่นคงเดิม)
  - `404 Not Found`: ไม่พบ ID นักศึกษาที่ต้องการแก้ไข
- **Response Example (200 OK):**
```json
{
  "message": "แก้ไขข้อมูลสำเร็จ",
  "data": {
    "id": 1,
    "name": "สมชาย ใจดี",
    "major": "ปัญญาประดิษฐ์",
    "email": "somchai@example.com",
    "phone": "080-000-0001",
    "courseIds": [101, 102]
  }
}
```

---

### 2.6 DELETE `/api/v1/students/{id}`
- **คำอธิบาย:** ลบข้อมูลนักศึกษาตาม ID
- **Status Codes:**
  - `200 OK`: ลบข้อมูลสำเร็จ
  - `404 Not Found`: ไม่พบ ID นักศึกษาที่ต้องการลบ
- **Response Example (200 OK):**
```json
{
  "message": "ลบข้อมูลสำเร็จ"
}
```

---

## 3. หลักการตั้งชื่อ RESTful URI ที่ปรับปรุง (RESTful Design Principles Applied)

1. **ใช้ คำนามพหูพจน์ (Plural Nouns):** ใช้ `/students` แทนคำกริยาหรือคำเดี่ยว
2. **ใช้ Query Parameter แทน Path ที่ไม่เป็นมาตรฐาน:** ปรับจาก `/students/1/full` มาใช้ `GET /students/1?include=courses` เพื่อแสดงถึง resource ความสัมพันธ์อย่างถูกต้อง
3. **ใช้ Status Code ตรงตามสถานการณ์:**
   - ใช้ `201 Created` เมื่อสร้างข้อมูลใหม่
   - ใช้ `409 Conflict` เมื่อเกิดข้อมูลซ้ำ (เช่น Email ซ้ำ)
   - ใช้ `400 Bad Request` เมื่อข้อมูลที่ส่งมาไม่ผ่าน Validation
   - ใช้ `404 Not Found` เมื่อค้นหา Resource ไม่พบ
4. **รองรับ Partial Update ด้วย PATCH:** แยกแยะระหว่าง `PUT` (Full Replace) และ `PATCH` (Partial Modification)

---

## 4. รายงานการตรวจสอบ Peer Check & Edge Cases Testing (ส่วนที่ 3)

### 4.1 แบบฟอร์ม Peer Check
**ผู้ตรวจสอบ:** Peer Reviewer  
**โปรเจกต์ที่ตรวจสอบ:** student-api  

| หัวข้อตรวจสอบ | ผลการตรวจสอบ | ข้อเสนอแนะ |
| :--- | :---: | :--- |
| 1. URI ใช้คำนามพหูพจน์ ไม่มีคำกริยาปน | Pass | ใช้ `/api/v1/students` ถูกต้องตามมาตรฐาน |
| 2. ใช้ตัวพิมพ์เล็กและขีดกลาง ไม่ใช้ camelCase หรือ underscore | Pass | Path ทุกจุดใช้ตัวพิมพ์เล็ก |
| 3. HTTP Method สอดคล้องกับการดำเนินการ | Pass | ใช้ GET, POST, PUT, PATCH, DELETE ตรงตามวัตถุประสงค์ |
| 4. Status Code ครอบคลุมทั้งกรณีสำเร็จและผิดพลาด | Pass | ครอบคลุม 200, 201, 400, 404, 409 ชัดเจน |
| 5. ความสัมพันธ์ระหว่าง resource แสดงด้วย nested path/query parameter เหมาะสม | Pass | ใช้ `?include=courses` ได้อย่างเหมาะสมตามมาตรฐาน REST |

---

### 4.2 ผลการทดสอบ Edge Cases (Postman / Automated Test)

1. **Test Case 1: GET `/api/v1/students/999` (ID ที่ไม่มีอยู่จริง)**
   - **Expected Result:** `404 Not Found`
   - **Actual Result:** `404 Not Found`
   - **Response Payload:** `{"error":{"code":"NOT_FOUND","message":"ไม่พบข้อมูลนักศึกษา"}}`
   - **Status:** PASS

2. **Test Case 2: POST `/api/v1/students` (ส่งข้อมูลไม่ครบ ขาด email)**
   - **Expected Result:** `400 Bad Request`
   - **Actual Result:** `400 Bad Request`
   - **Response Payload:** `{"error":{"code":"VALIDATION_ERROR","message":"กรุณาระบุ name, major และ email ให้ครบถ้วน"}}`
   - **Status:** PASS

3. **Test Case 3: POST `/api/v1/students` (ส่ง email ซ้ำกับที่มีในระบบ `somchai@example.com`)**
   - **Expected Result:** `409 Conflict`
   - **Actual Result:** `409 Conflict`
   - **Response Payload:** `{"error":{"code":"DUPLICATE_EMAIL","message":"อีเมลนี้มีอยู่ในระบบแล้ว"}}`
   - **Status:** PASS
