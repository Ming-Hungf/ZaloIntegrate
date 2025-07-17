# Group Processing Documentation

## 🔄 **Individual Group Processing Feature**

### Overview
Tính năng này cho phép xử lý thông tin từng group riêng biệt thay vì gọi API cho tất cả groups cùng lúc. Điều này giúp:
- Tránh lỗi API khi có quá nhiều groups
- Xử lý được các groups có vấn đề mà không ảnh hưởng đến groups khác
- Logging chi tiết cho từng group
- Kiểm soát tốt hơn quá trình xử lý

### Configuration

```javascript
// Trong server.js
const PROCESS_GROUPS_INDIVIDUALLY = true; // Set to false to process all groups at once
```

- `true`: Xử lý từng group riêng biệt (khuyến nghị)
- `false`: Xử lý tất cả groups cùng lúc (phương pháp cũ)

### Implementation

#### 1. **Group Utils Function**
```javascript
const groupUtils = {
  async processGroups(zaloApi, groupIds, logPrefix = '') {
    const groupEntities = [];
    
    if (PROCESS_GROUPS_INDIVIDUALLY) {
      // Xử lý từng group riêng biệt
      for (const groupId of groupIds) {
        try {
          const groupInfoResponse = await zaloApi.getGroupInfo([groupId]);
          const groupInfo = Object.values(groupInfoResponse.gridInfoMap)[0];
          if (groupInfo) {
            groupEntities.push(ChatEntityFactory.createFromGroup(groupInfo));
          }
        } catch (error) {
          console.warn(`Failed to get info for group ${groupId}:`, error.message);
        }
      }
    } else {
      // Xử lý tất cả groups cùng lúc
      const groupInfoResponse = await zaloApi.getGroupInfo(groupIds);
      const groups = Object.values(groupInfoResponse.gridInfoMap);
      groupEntities.push(...groups.map(group => ChatEntityFactory.createFromGroup(group)));
    }
    
    return groupEntities;
  }
};
```

#### 2. **Usage in Login Process**
```javascript
// Fetch groups
const groupsResponse = await session.zaloApi.getAllGroups();
const groupIds = Object.keys(groupsResponse.gridInfoMap);
const groupEntities = await groupUtils.processGroups(session.zaloApi, groupIds, '[Login] ');
```

#### 3. **Usage in Refresh Process**
```javascript
// Fetch groups
const groupsResponse = await session.zaloApi.getAllGroups();
const groupIds = Object.keys(groupsResponse.gridInfoMap);
const groupEntities = await groupUtils.processGroups(session.zaloApi, groupIds, '[Refresh] ');
```

### Logging Output

#### Individual Processing (PROCESS_GROUPS_INDIVIDUALLY = true)
```
[Login] Processing 15 groups individually...
[Login] Fetching info for group: 123456789
[Login] ✓ Successfully processed group: My Group Chat
[Login] Fetching info for group: 987654321
[Login] ✗ Failed to get info for group 987654321: API Error
[Login] Fetching info for group: 555666777
[Login] ✓ Successfully processed group: Work Team
...
[Login] Completed processing groups. Total: 13/15
```

#### Batch Processing (PROCESS_GROUPS_INDIVIDUALLY = false)
```
[Login] Processing 15 groups in batch...
[Login] ✓ Successfully processed 15 groups in batch
```

### Benefits

#### ✅ **Individual Processing Advantages:**
1. **Error Isolation**: Một group lỗi không ảnh hưởng đến groups khác
2. **Detailed Logging**: Biết chính xác group nào gặp vấn đề
3. **Partial Success**: Có thể lấy được một số groups ngay cả khi có lỗi
4. **API Rate Limiting**: Tránh quá tải API server
5. **Debugging**: Dễ dàng debug và troubleshoot

#### ⚠ **Individual Processing Disadvantages:**
1. **Slower**: Mất nhiều thời gian hơn do nhiều API calls
2. **More API Calls**: Tăng số lượng requests đến server

#### ✅ **Batch Processing Advantages:**
1. **Faster**: Chỉ một API call cho tất cả groups
2. **Fewer API Calls**: Giảm tải network

#### ⚠ **Batch Processing Disadvantages:**
1. **All or Nothing**: Một group lỗi có thể làm fail toàn bộ
2. **Limited Error Info**: Khó biết group nào gặp vấn đề
3. **API Limits**: Có thể vượt quá giới hạn API

### Error Handling

#### Individual Processing
```javascript
for (const groupId of groupIds) {
  try {
    // Process individual group
  } catch (error) {
    console.warn(`✗ Failed to get info for group ${groupId}:`, error.message);
    // Continue with next group
  }
}
```

#### Batch Processing
```javascript
try {
  // Process all groups at once
} catch (error) {
  console.warn(`✗ Failed to process groups in batch:`, error.message);
  // All groups fail
}
```

### Performance Comparison

| Method | Speed | Reliability | Error Handling | API Calls |
|--------|-------|-------------|----------------|-----------|
| Individual | Slower | Higher | Excellent | Many |
| Batch | Faster | Lower | Limited | Few |

### Recommendations

1. **Use Individual Processing** when:
   - You have many groups
   - Some groups might have issues
   - You need detailed error information
   - Reliability is more important than speed

2. **Use Batch Processing** when:
   - You have few groups
   - All groups are stable
   - Speed is critical
   - You want to minimize API calls

### Configuration Examples

#### For Production (Recommended)
```javascript
const PROCESS_GROUPS_INDIVIDUALLY = true;
```

#### For Development/Testing
```javascript
const PROCESS_GROUPS_INDIVIDUALLY = false; // For faster testing
```

### Monitoring

Monitor the logs to see:
- How many groups are being processed
- Which groups fail and why
- Processing time for each method
- Success rate comparison

This helps you decide which method works best for your use case.
