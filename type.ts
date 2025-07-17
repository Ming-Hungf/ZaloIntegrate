export type ChatEntityType = 'group' | 'friend';

export interface ChatEntity {
  id: string;
  displayName: string;
  avatar: string;
  type: ChatEntityType;
}

export class ChatEntityFactory {
  static createFromGroup(group: any): ChatEntity {
    return {
      id: group.groupId,
      displayName: group.name,
      avatar: group.avt || group.fullAvt || 'default_group_avatar.png',
      type: 'group'
    };
  }

  static createFromFriend(friend: any): ChatEntity {
    return {
      id: friend.userId,
      displayName: friend.displayName || friend.userName || 'Unknown',
      avatar: friend.avatar || 'default_friend_avatar.png',
      type: 'friend'
    };
  }
}
