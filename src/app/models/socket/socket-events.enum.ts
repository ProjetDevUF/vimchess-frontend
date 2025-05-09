export enum Lobby {
  update = 'lobby:update',
}

export enum GameEnd {
  surrender = 'surrender',
  timeout = 'timeout',
  draw = 'draw',
  mate = 'mate',
  playerLeave = 'playerLeave',
}

export enum Game {
  pendingGame = 'game:pending-one',
  created = 'game:created',
  init = 'game:init-data',
  start = 'game:start',
  shah = 'game:shah',
  mate = 'game:mate',
  end = 'game:end',
  draw = 'game:draw',
  rejectDraw = 'game:draw_rejected',
  addTime = 'game:add-time',
  timeTick = 'game:time',
  strike = 'game:strike',
  boardUpdate = 'game:board-update',
  message = 'game:chat-message',
  surrender = 'game:surrender',
  drawPropose = 'game:draw_propose',
  playerDiconnected = 'game:opponent-disconnected',
  playerReconected = 'game:player-reconnected',
}

export enum Matchmaking {
  joinQueue = 'matchmaking:join_queue',
  leaveQueue = 'matchmaking:leave_queue',
  matchFound = 'matchmaking:match_found',
  acceptMatch = 'matchmaking:accept_match',
  timeout = 'matchmaking:timeout',
  opponentTimeout = 'matchmaking:opponent_timeout',
  queueStatus = 'matchmaking:queue_status',
  rematchPropose = 'matchmaking:rematch_propose',
  rematchAccept = 'matchmaking:rematch_accept',
  rematchReject = 'matchmaking:rematch_reject',
}

export enum User {
  anonymousToken = 'user:anon-token',
}

/**
 * Génère le nom de la salle pour une partie
 * @param id ID de la partie
 * @returns string: game:{id}
 */
export const room = (id: number) => `game:${id}`;
