export interface TimeUnit {
  name: string;
  seconds: number;
}

export interface TimeSystem {
  type: 'real' | 'fictional';
  epoch_zero_label: string;
  epoch_zero_date?: string;
  units?: TimeUnit[];
}

export interface UniverseStyle {
  default_pov: 'first' | 'third-limited' | 'third-omniscient' | 'narrator';
  tone: string;
  language: string;
}

export interface Universe {
  name: string;
  description: string;
  time_system: TimeSystem;
  style: UniverseStyle;
  created_at: string;
}

export interface CharacterRelationship {
  target: string;
  type: string;
  description: string;
  since_epoch: number;
}

export interface LearnRecord {
  event: string;
  at_epoch: number;
  method: 'witnessed' | 'told_by' | 'discovered' | 'rumor' | 'letter';
  source?: string;
  notes?: string;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  traits: string[];
  backstory: string;
  affiliations: string[];
  relationships: CharacterRelationship[];
  learns: LearnRecord[];
  status: 'alive' | 'dead' | 'unknown';
  first_appearance_epoch: number;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  epoch: number;
  end_epoch?: number;
  location: string;
  participants: string[];
  visibility: 'public' | 'participants' | 'secret';
  tags: string[];
  consequences?: string[];
  created_at: string;
}

export interface SceneFrontmatter {
  id: string;
  title: string;
  event: string;
  epoch: number;
  location: string;
  pov: string;
  characters: string[];
  summary: string;
  word_count: number;
  status: 'draft' | 'review' | 'final';
  created_at: string;
}

export interface Chapter {
  id: string;
  title: string;
  number: number;
  summary: string;
  scenes: string[];
  status: 'draft' | 'review' | 'final';
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  parent?: string;
  tags: string[];
  created_at: string;
}

export interface Concept {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  owner?: string;
  location?: string;
  tags: string[];
  created_at: string;
}
