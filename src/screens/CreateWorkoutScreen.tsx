import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  FlatList,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { Exercise, CreateWorkoutForm, CreateExerciseForm } from '../types';

type RootStackParamList = {
  CreateWorkout: undefined;
  Home: undefined;
};

type CreateWorkoutScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CreateWorkout'
>;

interface Props {
  navigation: CreateWorkoutScreenNavigationProp;
}

const CreateWorkoutScreen: React.FC<Props> = ({ navigation }) => {
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<CreateExerciseForm[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (error) throw error;
      setExercises(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const addExerciseToWorkout = (exercise: Exercise) => {
    const newExercise: CreateExerciseForm = {
      exercise_id: exercise.id,
      sets: [{ weight: undefined, reps: 8 }], // Default 1 set with 8 reps
    };
    setSelectedExercises([...selectedExercises, newExercise]);
  };

  const removeExerciseFromWorkout = (index: number) => {
    const updatedExercises = selectedExercises.filter((_, i) => i !== index);
    setSelectedExercises(updatedExercises);
  };

  const addSetToExercise = (exerciseIndex: number) => {
    const updatedExercises = [...selectedExercises];
    updatedExercises[exerciseIndex].sets.push({ weight: undefined, reps: 8 });
    setSelectedExercises(updatedExercises);
  };

  const removeSetFromExercise = (exerciseIndex: number, setIndex: number) => {
    const updatedExercises = [...selectedExercises];
    updatedExercises[exerciseIndex].sets.splice(setIndex, 1);
    setSelectedExercises(updatedExercises);
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    value: number
  ) => {
    const updatedExercises = [...selectedExercises];
    updatedExercises[exerciseIndex].sets[setIndex][field] = value;
    setSelectedExercises(updatedExercises);
  };

  const createWorkout = async () => {
    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    setLoading(true);
    try {
      // Create workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          name: workoutName.trim(),
          description: workoutDescription.trim() || null,
          user_id: user?.id,
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      // Add exercises to workout
      for (let i = 0; i < selectedExercises.length; i++) {
        const exerciseForm = selectedExercises[i];

        // Create workout_exercise junction record
        const { data: workoutExerciseData, error: weError } = await supabase
          .from('workout_exercises')
          .insert({
            workout_id: workoutData.id,
            exercise_id: exerciseForm.exercise_id,
            order: i,
          })
          .select()
          .single();

        if (weError) throw weError;

        // Create sets for this exercise
        const setsToInsert = exerciseForm.sets.map((set) => ({
          workout_exercise_id: workoutExerciseData.id,
          weight: set.weight,
          reps: set.reps,
          completed: false,
        }));

        const { error: setsError } = await supabase
          .from('sets')
          .insert(setsToInsert);

        if (setsError) throw setsError;
      }

      Alert.alert('Success', 'Workout created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSelectedExercise = ({ item, index }: { item: CreateExerciseForm; index: number }) => {
    const exercise = exercises.find((ex) => ex.id === item.exercise_id);
    if (!exercise) return null;

    return (
      <View style={styles.selectedExerciseCard}>
        <View style={styles.exerciseHeader}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeExerciseFromWorkout(index)}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>

        {item.sets.map((set, setIndex) => (
          <View key={setIndex} style={styles.setRow}>
            <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="Weight"
              keyboardType="numeric"
              value={set.weight?.toString() || ''}
              onChangeText={(value) =>
                updateSet(index, setIndex, 'weight', parseFloat(value) || 0)
              }
            />
            <TextInput
              style={styles.repsInput}
              placeholder="Reps"
              keyboardType="numeric"
              value={set.reps.toString()}
              onChangeText={(value) =>
                updateSet(index, setIndex, 'reps', parseInt(value) || 0)
              }
            />
            <TouchableOpacity
              style={styles.removeSetButton}
              onPress={() => removeSetFromExercise(index, setIndex)}
            >
              <Text style={styles.removeSetText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addSetButton}
          onPress={() => addSetToExercise(index)}
        >
          <Text style={styles.addSetText}>Add Set</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
    const isSelected = selectedExercises.some((ex) => ex.exercise_id === item.id);

    return (
      <TouchableOpacity
        style={[styles.exerciseItem, isSelected && styles.exerciseItemSelected]}
        onPress={() => !isSelected && addExerciseToWorkout(item)}
        disabled={isSelected}
      >
        <Text style={[styles.exerciseItemText, isSelected && styles.exerciseItemTextSelected]}>
          {item.name}
        </Text>
        {isSelected && <Text style={styles.selectedText}>Added</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.sectionTitle}>Workout Details</Text>

        <TextInput
          style={styles.input}
          placeholder="Workout Name"
          value={workoutName}
          onChangeText={setWorkoutName}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description (optional)"
          value={workoutDescription}
          onChangeText={setWorkoutDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.sectionTitle}>Selected Exercises</Text>

        {selectedExercises.length === 0 ? (
          <Text style={styles.emptyText}>No exercises added yet</Text>
        ) : (
          <FlatList
            data={selectedExercises}
            renderItem={renderSelectedExercise}
            keyExtractor={(_, index) => index.toString()}
            scrollEnabled={false}
          />
        )}

        <Text style={styles.sectionTitle}>Available Exercises</Text>

        <FlatList
          data={exercises}
          renderItem={renderExercise}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={createWorkout}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Workout'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectedExerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  removeButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  setLabel: {
    fontSize: 14,
    color: '#64748b',
    width: 60,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    marginHorizontal: 8,
    fontSize: 14,
  },
  repsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    marginHorizontal: 8,
    fontSize: 14,
  },
  removeSetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeSetText: {
    color: '#dc2626',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addSetButton: {
    backgroundColor: '#dbeafe',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  addSetText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  exerciseItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  exerciseItemSelected: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
  },
  exerciseItemText: {
    fontSize: 16,
    color: '#374151',
  },
  exerciseItemTextSelected: {
    color: '#0ea5e9',
    fontWeight: '500',
  },
  selectedText: {
    fontSize: 12,
    color: '#0ea5e9',
    fontWeight: '500',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateWorkoutScreen;
