# 👤 User Management API - Quick Reference

**Implemented:** 24/01/2026  
**Status:** ✅ Ready for Testing

---

## Endpoints Summary

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/users` | Create user with relationships | ✅ |
| GET | `/api/users` | List users (pagination) | ✅ |
| GET | `/api/users/:id` | Get user detail | ✅ |
| PUT | `/api/users/:id` | Update user profile | ✅ |
| DELETE | `/api/users/:id` | Delete user | ✅ |

---

## 1. CREATE USER (POST /api/users)

### Request
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "zalo_group_id": "g123",
    "zalo_id": "u456",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+84 901234567",
    "address": "123 Main St, HCM",
    "gender": "male"
  }'
```

### Required Fields
- `zalo_group_id` (string)
- `zalo_id` (string)
- `name` (string)

### Optional Fields
- `email` (string)
- `phone` (string)
- `address` (string)
- `gender` (string: male/female/other)

### Success Response (201)
```json
{
  "success": true,
  "data": {
    "user_id": "uuid-xxx",
    "zalo_id": "u456",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+84 901234567",
    "address": "123 Main St, HCM",
    "gender": "male",
    "zalo_group_id": "g123",
    "workspace_id": "ws-xyz",
    "created_at": "2024-01-24T10:30:00Z"
  }
}
```

### Error Cases
| Code | Case | Message |
|------|------|---------|
| 400 | Missing required fields | Clear error message |
| 409 | User already exists | "User with zalo_id X already exists" |
| 404 | Workspace not found | "Workspace not found for zalo_group_id X" |
| 500 | DB/Neo4j error | Error details |

---

## 2. LIST USERS (GET /api/users)

### Request
```bash
curl -X GET "http://localhost:3000/api/users?limit=20&offset=0"
```

### Query Parameters
- `limit` (default: 20, max: 100)
- `offset` (default: 0)

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-1",
        "zalo_id": "u456",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+84 901234567",
        "address": "123 Main St, HCM",
        "gender": "male",
        "created_at": "2024-01-24T10:30:00Z",
        "updated_at": "2024-01-24T10:30:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 50,
      "hasMore": true
    }
  }
}
```

---

## 3. GET USER (GET /api/users/:id)

### Request
```bash
curl -X GET http://localhost:3000/api/users/uuid-xxx
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "zalo_id": "u456",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+84 901234567",
    "address": "123 Main St, HCM",
    "gender": "male",
    "created_at": "2024-01-24T10:30:00Z",
    "updated_at": "2024-01-24T10:30:00Z"
  }
}
```

### Error
| Code | Case |
|------|------|
| 404 | User not found |

---

## 4. UPDATE USER (PUT /api/users/:id)

### Request
```bash
curl -X PUT http://localhost:3000/api/users/uuid-xxx \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "phone": "+84 909876543"
  }'
```

### Updatable Fields
- `name`
- `email`
- `phone`
- `address`
- `gender`

### Non-updatable
- `zalo_id` (immutable) - Will get 400 error if attempted

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "zalo_id": "u456",
    "name": "John Doe",
    "email": "newemail@example.com",
    "phone": "+84 909876543",
    "address": "123 Main St, HCM",
    "gender": "male",
    "created_at": "2024-01-24T10:30:00Z",
    "updated_at": "2024-01-24T11:00:00Z"
  }
}
```

---

## 5. DELETE USER (DELETE /api/users/:id)

### Request
```bash
curl -X DELETE http://localhost:3000/api/users/uuid-xxx
```

### Success Response (200)
```json
{
  "success": true,
  "message": "User deleted: uuid-xxx"
}
```

### Notes
- Soft delete (removed from PostgreSQL)
- Neo4j relationships preserved for audit
- User cannot be recovered

---

## 🔄 Behind the Scenes (What Happens)

When you POST `/api/users`:

1. **Validate input** - Check required fields & email format
2. **Check duplicate** - Verify zalo_id not already used
3. **Create in PostgreSQL** - Insert into `users` table
4. **Resolve workspace** - Find workspace via zalo_group_id
5. **Create in Neo4j** - Create/Update ZaloUser node
6. **Link to group** - Create MEMBER_OF relationship
7. **Link to workspace** - Create PART_OF relationship
8. **Return confirmation** - Send user_id & details

All in **one API call**! ✨

---

## 📊 Database Structure

### PostgreSQL (users table)
```sql
id (UUID)
zalo_id (VARCHAR UNIQUE)
name (VARCHAR)
email (VARCHAR)
phone (VARCHAR)
address (TEXT)
gender (VARCHAR)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### Neo4j Relationships
```
User -[:MEMBER_OF {role, joined_at}]-> ZaloGroup
User -[:PART_OF {joined_at}]-> Workspace
```

---

## ✅ Validation Rules

| Field | Rules |
|-------|-------|
| `zalo_id` | Required, unique, immutable |
| `name` | Required, not empty |
| `email` | Optional, must be valid format |
| `phone` | Optional, any format accepted |
| `address` | Optional, any length |
| `gender` | Optional, any value accepted |
| `zalo_group_id` | Required for creation, must exist |

---

## 🔐 Error Handling

All errors follow standard format:
```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

With appropriate HTTP status codes:
- 400 - Bad Request (validation)
- 404 - Not Found
- 409 - Conflict (duplicate)
- 500 - Server Error

---

## 🧪 Test Checklist

- [ ] Create user with all fields
- [ ] Create user with minimum fields (name, zalo_id, zalo_group_id)
- [ ] Try create with invalid email → 400
- [ ] Try create duplicate → 409
- [ ] Try create with non-existent group → 404
- [ ] List users with pagination
- [ ] Get specific user
- [ ] Update user profile
- [ ] Try update zalo_id → 400
- [ ] Delete user
- [ ] Verify Neo4j relationships in Neo4j Browser
- [ ] Verify user can call resolve-workspace-context

---

## 🚀 Integration with AI Agent

**Example: AI Agent adding user to contact list**

```javascript
// AI Agent code (n8n/make)
async function addUserToContactList(groupId, userData) {
  const response = await fetch('http://backend:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zalo_group_id: groupId,
      zalo_id: userData.zaloId,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      gender: userData.gender
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log(`User created: ${result.data.user_id}`);
    return result.data;
  } else {
    console.error(`Failed: ${result.error}`);
    throw new Error(result.error);
  }
}
```

---

## 📚 Related Documentation

- Full API documentation: `API.md` (section 6-10)
- Database design: `database2.md` (section 4.5)
- Implementation details: `PHASE3_COMPLETION.md`
- Testing guide: `TESTING_GUIDE.md`

---

**Last Updated:** 24/01/2026  
**Version:** 1.0  
**Ready for:** Testing & Integration
