// Contracts between the controller, the HUD and the sound.
import { ClimberId, RuleSet, Stats } from './rules';

export interface PlayerView { id: ClimberId; human: boolean; tile: number; charmReady: boolean; active: boolean }
export interface ResultRow { id: ClimberId; tile: number; stats: Stats; winner: boolean }
export interface StartOptions { rules: RuleSet; me: ClimberId; rivals: number; friends: boolean }

export interface Hud {
  screen(s: 'title' | 'climb' | 'result'): void;
  players(list: PlayerView[], rules: RuleSet): void;
  turn(text: string, color: string): void;
  banner(title: string, sub: string, color: string, seconds: number): void;
  journal(line: string, color?: string): void;
  clearJournal(): void;
  callNumber(n: number, color: string): void;
  roll(enabled: boolean): void;
  charm(o: { visible: boolean; name: string; ready: boolean; usable: boolean; hint: string }): void;
  askDie(): Promise<number | null>;
  askTarget(targets: { index: number; id: ClimberId; tile: number }[]): Promise<number | null>;
  askSnakeCharm(serpent: string, fall: number, saved: number): Promise<boolean>;
  intro(ids: ClimberId[], show: boolean): void;
  result(o: { winner: ClimberId; youWon: boolean; rows: ResultRow[]; rounds: number } | null): void;
  lastStretch(on: boolean): void;
  viewLabel(v: 'temple' | 'climber'): void;
}

export type Sfx =
  | 'die' | 'dieSettle' | 'hop' | 'ladder' | 'strike' | 'thud' | 'nearMiss' | 'chime' | 'rope' | 'flute' | 'ringDie' | 'horn'
  | 'thunder' | 'win' | 'click' | 'blocked' | 'banner';

export interface Sound {
  play(name: Sfx, arg?: number): void;
  heartbeat(on: boolean): void;
  phase(p: 'title' | 'play' | 'last' | 'win'): void;
}
