/**
 * Énumération des événements socket liés au lobby de jeu.
 * Définit les types d'événements émis et reçus pour la gestion du lobby.
 */
export enum Lobby {
  /** Émis lorsque la liste des parties disponibles est mise à jour */
  update = 'lobby:update',
}

/**
 * Énumération des raisons de fin de partie.
 * Définit les différentes manières dont une partie d'échecs peut se terminer.
 */
export enum GameEnd {
  /** La partie s'est terminée par un abandon volontaire d'un joueur */
  surrender = 'surrender',
  /** La partie s'est terminée par un dépassement de temps d'un joueur */
  timeout = 'timeout',
  /** La partie s'est terminée par un match nul (accord mutuel, pat, etc.) */
  draw = 'draw',
  /** La partie s'est terminée par un échec et mat */
  mate = 'mate',
  /** La partie s'est terminée car un joueur a quitté la partie */
  playerLeave = 'playerLeave',
}

/**
 * Énumération des événements socket liés à une partie d'échecs.
 * Définit les types d'événements émis et reçus pendant le déroulement d'une partie.
 */
export enum Game {
  /** Émis lorsqu'une partie est en attente de joueurs */
  pendingGame = 'game:pending-one',
  /** Émis lorsqu'une nouvelle partie est créée */
  created = 'game:created',
  /** Émis pour initialiser l'état d'une partie pour un client */
  init = 'game:init-data',
  /** Émis lorsqu'une partie commence officiellement */
  start = 'game:start',
  /** Émis lorsqu'un roi est mis en échec */
  shah = 'game:shah',
  /** Émis lorsqu'un échec et mat se produit */
  mate = 'game:mate',
  /** Émis lorsqu'une partie se termine (pour toute raison) */
  end = 'game:end',
  /** Émis lorsqu'une partie se termine par un match nul */
  draw = 'game:draw',
  /** Émis lorsqu'une proposition de match nul est rejetée */
  rejectDraw = 'game:draw_rejected',
  /** Émis lorsque du temps est ajouté à l'horloge d'un joueur */
  addTime = 'game:add-time',
  /** Émis à chaque mise à jour des horloges des joueurs */
  timeTick = 'game:time',
  /** Émis lorsqu'un avertissement est donné à un joueur */
  strike = 'game:strike',
  /** Émis lorsque l'état du plateau est mis à jour (après un coup) */
  boardUpdate = 'game:board-update',
  /** Émis lorsqu'un message est envoyé dans le chat de la partie */
  message = 'game:chat-message',
  /** Émis lorsqu'un joueur abandonne la partie */
  surrender = 'game:surrender',
  /** Émis lorsqu'un joueur propose un match nul */
  drawPropose = 'game:draw_propose',
  /** Émis lorsqu'un joueur se déconnecte pendant une partie */
  playerDiconnected = 'game:opponent-disconnected',
  /** Émis lorsqu'un joueur se reconnecte à une partie en cours */
  playerReconected = 'game:player-reconnected',
}

/**
 * Énumération des événements socket liés au système de matchmaking.
 * Définit les types d'événements émis et reçus pour la recherche et proposition de parties.
 */
export enum Matchmaking {
  /** Émis lorsqu'un joueur rejoint la file d'attente de matchmaking */
  joinQueue = 'matchmaking:join_queue',
  /** Émis lorsqu'un joueur quitte la file d'attente de matchmaking */
  leaveQueue = 'matchmaking:leave_queue',
  /** Émis lorsqu'un adversaire potentiel est trouvé */
  matchFound = 'matchmaking:match_found',
  /** Émis lorsqu'un joueur accepte la proposition de match */
  acceptMatch = 'matchmaking:accept_match',
  /** Émis lorsqu'un joueur ne répond pas à temps à une proposition de match */
  timeout = 'matchmaking:timeout',
  /** Émis lorsque l'adversaire ne répond pas à temps à une proposition de match */
  opponentTimeout = 'matchmaking:opponent_timeout',
  /** Émis pour informer un joueur de sa position dans la file d'attente */
  queueStatus = 'matchmaking:queue_status',
  /** Émis lorsqu'un joueur propose une revanche après une partie */
  rematchPropose = 'matchmaking:rematch_propose',
  /** Émis lorsqu'un joueur accepte une proposition de revanche */
  rematchAccept = 'matchmaking:rematch_accept',
  /** Émis lorsqu'un joueur refuse une proposition de revanche */
  rematchReject = 'matchmaking:rematch_reject',
}

/**
 * Énumération des événements socket liés à la gestion des utilisateurs.
 * Définit les types d'événements émis et reçus pour l'authentification et les sessions.
 */
export enum User {
  /** Émis pour fournir un token anonyme temporaire à un utilisateur non connecté */
  anonymousToken = 'user:anon-token',
}

/**
 * Génère le nom de la salle socket pour une partie spécifique.
 * Utilisé pour s'abonner aux événements d'une partie particulière.
 *
 * @param id Identifiant numérique de la partie
 * @returns Nom formaté de la salle socket au format "game:{id}"
 */
export const room = (id: number) => `game:${id}`;
