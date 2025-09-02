export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  category?: string;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  completed_at?: string;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  order: number;
  created_at: string;
}

export interface Set {
  id: string;
  workout_exercise_id: string;
  weight?: number;
  reps: number;
  completed: boolean;
  created_at: string;
}

export interface WorkoutWithExercises extends Workout {
  exercises: (Exercise & {
    workout_exercise_id: string;
    sets: Set[];
  })[];
}

// Form types for creating/editing
export interface CreateWorkoutForm {
  name: string;
  description?: string;
  exercises: CreateExerciseForm[];
}

export interface CreateExerciseForm {
  exercise_id: string;
  sets: CreateSetForm[];
}

export interface CreateSetForm {
  weight?: number;
  reps: number;
}
