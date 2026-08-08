export { default as FroamGate, type FroamGateProps } from './editor/FroamGate';
export { default as FroamRuntime, type FroamRuntimeProps, type FroamLocalDesign } from './editor/FroamRuntime';
export { configureFroamStudio, getFroamRootElement, getFroamStudioConfig, resetFroamStudioConfig, type FroamAuthProvider, type FroamAuthUser, type FroamStudioConfig, } from './config';
export { createRoomClient, inviteLink, readOwnedRoom, readRoomFromLocation, type RoomClient, type RoomIdentity, type RoomMemberView, type RoomTransport, type RoomView, } from './collab/room';
export { useFroamRoom, type RoomWhere } from './collab/useFroamRoom';
export * from './project/index';
export type { FroamChatMessage, FroamMember, FroamOp, FroamPresence, FroamRevertProposal, FroamRole, FroamRoom, FroamRoomEvent, FroamStructuralChange, } from './collab/types';
//# sourceMappingURL=index.d.ts.map