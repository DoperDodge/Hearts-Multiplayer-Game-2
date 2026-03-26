import { Card, BotDifficulty } from '@shared/game-types';
import { BotPlayer, BotDecisionContext, BotPassContext } from './BotPlayer';
export class EasyBot extends BotPlayer {
  readonly difficulty = BotDifficulty.EASY;
  readonly name: string;
  constructor(name?: string) { super(); this.name = name || 'Bumbling Bill'; }
  choosePassCards(ctx: BotPassContext): Card[] { return [...ctx.hand].sort(() => Math.random() - 0.5).slice(0, 3); }
  choosePlay(ctx: BotDecisionContext): Card { return ctx.legalMoves[Math.floor(Math.random() * ctx.legalMoves.length)]; }
}
