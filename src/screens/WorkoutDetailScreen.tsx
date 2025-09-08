import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { WorkoutWithExercises, Exercise, Set as SetType } from '../types';

type RootStackParamList = {
  WorkoutDetail: { workoutId: string };
  Home: undefined;
};

type WorkoutDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'WorkoutDetail'
>;

type WorkoutDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  'WorkoutDetail'
>;

interface Props {
  navigation: WorkoutDetailScreenNavigationProp;
  route: WorkoutDetailScreenRouteProp;
}

const WorkoutDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { workoutId } = route.params;
  const [workout, setWorkout] = useState<WorkoutWithExercises | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, { weight?: string; reps?: string }>>({});

  type PreviousSet = { weight?: number | null; reps?: number | null };
  const [previousByExerciseId, setPreviousByExerciseId] = useState<Record<string, PreviousSet[]>>({});

  useEffect(() => {
    fetchWorkoutDetails();
  }, [workoutId]);

  const fetchWorkoutDetails = async () => {
    try {
      // First get the workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .single();

      if (workoutError) throw workoutError;

      // Then get exercises with their sets
      const { data: workoutExercises, error: weError } = await supabase
        .from('workout_exercises')
        .select(`
          id,
          order,
          exercises (
            id,
            name,
            description
          ),
          sets (
            id,
            weight,
            reps,
            completed,
            created_at
          )
        `)
        .eq('workout_id', workoutId)
        .order('order');

      if (weError) throw weError;

      // Transform the data
      const exercises = workoutExercises.map((we: any) => ({
        workout_exercise_id: we.id,
        id: we.exercises.id,
        name: we.exercises.name,
        description: we.exercises.description,
        sets: we.sets.sort((a: SetType, b: SetType) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }));

      // Fetch previous workout sets per exercise (most recent previous workout before this workout's created_at)
      const prevMap: Record<string, PreviousSet[]> = {};
      await Promise.all(
        exercises.map(async (ex) => {
          const { data: prevWe, error: prevErr } = await supabase
            .from('workout_exercises')
            .select(`
              id,
              sets (
                id,
                weight,
                reps,
                created_at
              ),
              workouts!inner (
                created_at,
                user_id
              )
            `)
            .eq('exercise_id', ex.id)
            .lt('workouts.created_at', workoutData.created_at)
            .eq('workouts.user_id', workoutData.user_id)
            .order('created_at', { referencedTable: 'workouts', ascending: false })
            .limit(1);

          if (!prevErr && prevWe && prevWe.length > 0) {
            const setsSorted = ((prevWe[0] as any).sets as Array<{ created_at: string; weight?: number | null; reps?: number | null }>)
              .slice()
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            prevMap[ex.id] = setsSorted.map((s: { weight?: number | null; reps?: number | null }) => ({ weight: s.weight ?? null, reps: s.reps ?? null }));
          } else {
            prevMap[ex.id] = [];
          }
        })
      );

      // Initialize input values from current sets
      const initialInputs: Record<string, { weight?: string; reps?: string }> = {};
      exercises.forEach((ex) => {
        ex.sets.forEach((s: SetType) => {
          initialInputs[s.id] = {
            weight: s.weight !== undefined && s.weight !== null ? String(s.weight) : '',
            reps: s.reps !== undefined && s.reps !== null ? String(s.reps) : '',
          };
        });
      });

      setPreviousByExerciseId(prevMap);
      setInputValues(initialInputs);
      setWorkout({
        ...workoutData,
        exercises,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetCompletion = async (setId: string, completed: boolean) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('sets')
        .update({ completed: !completed })
        .eq('id', setId);

      if (error) throw error;

      // Update local state
      if (workout) {
        const updatedWorkout = { ...workout };
        updatedWorkout.exercises = updatedWorkout.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, completed: !completed } : set
          ),
        }));
        setWorkout(updatedWorkout);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUpdating(false);
    }
  };

  const updateSetReps = async (setId: string, newReps: number) => {
    setUpdating(true);
    try {
      const safeReps = Math.max(0, Math.floor(newReps || 0));
      const { error } = await supabase
        .from('sets')
        .update({ reps: safeReps })
        .eq('id', setId);

      if (error) throw error;

      if (workout) {
        const updatedWorkout = { ...workout } as WorkoutWithExercises;
        updatedWorkout.exercises = updatedWorkout.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, reps: safeReps } : set
          ),
        }));
        setWorkout(updatedWorkout);
      }
      setInputValues((prev) => ({
        ...prev,
        [setId]: { ...(prev[setId] || {}), reps: String(safeReps) },
      }));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUpdating(false);
    }
  };

  const updateSetWeight = async (setId: string, newWeight?: number) => {
    setUpdating(true);
    try {
      const weightValue = newWeight === undefined || isNaN(newWeight)
        ? null
        : Number(newWeight);
      const { error } = await supabase
        .from('sets')
        .update({ weight: weightValue as any })
        .eq('id', setId);

      if (error) throw error;

      if (workout) {
        const updatedWorkout = { ...workout } as WorkoutWithExercises;
        updatedWorkout.exercises = updatedWorkout.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, weight: (weightValue as unknown as number | undefined) } : set
          ),
        }));
        setWorkout(updatedWorkout);
      }
      setInputValues((prev) => ({
        ...prev,
        [setId]: { ...(prev[setId] || {}), weight: weightValue !== null && weightValue !== undefined ? String(weightValue) : '' },
      }));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUpdating(false);
    }
  };

  const completeWorkout = async () => {
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', workoutId);

      if (error) throw error;

      Alert.alert('Success', 'Workout completed!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getTotalSets = () => {
    if (!workout) return 0;
    return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  };

  const getCompletedSets = () => {
    if (!workout) return 0;
    return workout.exercises.reduce(
      (total, exercise) =>
        total + exercise.sets.filter((set) => set.completed).length,
      0
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading workout...</Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.centerContainer}>
        <Text>Workout not found</Text>
      </View>
    );
  }

  const totalSets = getTotalSets();
  const completedSets = getCompletedSets();
  const progressPercentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          {workout.description && (
            <Text style={styles.workoutDescription}>{workout.description}</Text>
          )}
          <Text style={styles.workoutDate}>
            Created: {new Date(workout.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Progress: {completedSets}/{totalSets} sets completed
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>
          <Text style={styles.progressPercentage}>
            {Math.round(progressPercentage)}% complete
          </Text>
        </View>

        {workout.exercises.map((exercise, exerciseIndex) => {
          const prevSets = previousByExerciseId[exercise.id] || [];
          return (
            <View key={`${exercise.id}-${exerciseIndex}`} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              {exercise.description && (
                <Text style={styles.exerciseDescription}>{exercise.description}</Text>
              )}

              <View style={styles.gridHeaderRow}>
                <Text style={[styles.gridHeaderCell, styles.gridCellSet]}>Set</Text>
                <Text style={[styles.gridHeaderCell, styles.gridCellPrevious]}>Previous</Text>
                <Text style={[styles.gridHeaderCell, styles.gridCellLbs]}>Lbs</Text>
                <Text style={[styles.gridHeaderCell, styles.gridCellReps]}>Reps</Text>
                <Text style={[styles.gridHeaderCell, styles.gridCellComplete]}>Complete</Text>
              </View>

              {exercise.sets.map((set, setIndex) => {
                const prev = prevSets[setIndex];
                const prevText = prev && prev.weight != null && prev.reps != null
                  ? `${prev.weight}x${prev.reps}`
                  : '-';
                const currentInputs = inputValues[set.id] || {};
                return (
                  <View key={`${set.id}-${setIndex}`} style={styles.gridRow}>
                    <Text style={[styles.gridCell, styles.gridCellSet]}>{setIndex + 1}</Text>
                    <Text style={[styles.gridCell, styles.gridCellPrevious]}>{prevText}</Text>
                    <View style={[styles.gridCell, styles.gridCellLbs]}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={currentInputs.weight ?? ''}
                        onChangeText={(t) =>
                          setInputValues((prevVals) => ({
                            ...prevVals,
                            [set.id]: { ...(prevVals[set.id] || {}), weight: t },
                          }))
                        }
                        onEndEditing={() => {
                          const num = currentInputs.weight === '' || currentInputs.weight == null ? undefined : Number(currentInputs.weight);
                          updateSetWeight(set.id, num);
                        }}
                        placeholder="0"
                        editable={!updating}
                      />
                    </View>
                    <View style={[styles.gridCell, styles.gridCellReps]}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={currentInputs.reps ?? ''}
                        onChangeText={(t) =>
                          setInputValues((prevVals) => ({
                            ...prevVals,
                            [set.id]: { ...(prevVals[set.id] || {}), reps: t },
                          }))
                        }
                        onEndEditing={() => {
                          const num = currentInputs.reps === '' || currentInputs.reps == null ? 0 : Number(currentInputs.reps);
                          updateSetReps(set.id, num);
                        }}
                        placeholder="0"
                        editable={!updating}
                      />
                    </View>
                    <View style={[styles.gridCell, styles.gridCellComplete]}>
                      <TouchableOpacity
                        style={[
                          styles.completeButton,
                          set.completed && styles.completedButton,
                        ]}
                        onPress={() => toggleSetCompletion(set.id, set.completed)}
                        disabled={updating}
                      >
                        <Text
                          style={[
                            styles.completeButtonText,
                            set.completed && styles.completedButtonText,
                          ]}
                        >
                          {set.completed ? '✓' : '○'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {!workout.completed_at && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.completeWorkoutButton,
              completedSets === totalSets && styles.completeWorkoutButtonActive,
            ]}
            onPress={completeWorkout}
            disabled={completedSets !== totalSets}
          >
            <Text style={styles.completeWorkoutButtonText}>
              Complete Workout
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  workoutName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  workoutDescription: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 8,
  },
  workoutDate: {
    fontSize: 14,
    color: '#94a3b8',
  },
  progressContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  exerciseDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  gridHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  gridCell: {
    justifyContent: 'center',
  },
  gridCellSet: {
    width: 50,
  },
  gridCellPrevious: {
    flex: 1,
  },
  gridCellLbs: {
    width: 90,
    paddingRight: 8,
  },
  gridCellReps: {
    width: 90,
    paddingRight: 8,
  },
  gridCellComplete: {
    width: 80,
    alignItems: 'flex-end',
  },
  input: {
    height: 36,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  setLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    width: 80,
  },
  setDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  setInfo: {
    fontSize: 14,
    color: '#64748b',
    marginHorizontal: 8,
  },
  completeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#dcfce7',
  },
  completeButtonText: {
    fontSize: 18,
    color: '#64748b',
  },
  completedButtonText: {
    color: '#059669',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  completeWorkoutButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  completeWorkoutButtonActive: {
    backgroundColor: '#059669',
  },
  completeWorkoutButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WorkoutDetailScreen;
