import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { Workout, WorkoutWithExercises } from '../types';

type RootStackParamList = {
  WorkoutHistory: undefined;
  WorkoutDetail: { workoutId: string };
  Home: undefined;
};

type WorkoutHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'WorkoutHistory'
>;

interface Props {
  navigation: WorkoutHistoryScreenNavigationProp;
}

const WorkoutHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [workouts, setWorkouts] = useState<WorkoutWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const { user } = useAuth();

  useEffect(() => {
    fetchWorkoutHistory();
  }, [filter]);

  const fetchWorkoutHistory = async () => {
    try {
      let query = supabase
        .from('workouts')
        .select(`
          *,
          workout_exercises (
            exercises (
              name
            ),
            sets (
              completed,
              weight,
              reps
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter === 'completed') {
        query = query.not('completed_at', 'is', null);
      } else if (filter === 'incomplete') {
        query = query.is('completed_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include exercise and set counts
      const transformedWorkouts = data.map((workout: any) => ({
        ...workout,
        totalExercises: workout.workout_exercises?.length || 0,
        totalSets: workout.workout_exercises?.reduce(
          (total: number, we: any) => total + (we.sets?.length || 0),
          0
        ) || 0,
        completedSets: workout.workout_exercises?.reduce(
          (total: number, we: any) =>
            total + (we.sets?.filter((s: any) => s.completed).length || 0),
          0
        ) || 0,
      }));

      setWorkouts(transformedWorkouts);
    } catch (error: any) {
      console.error('Error fetching workout history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWorkoutStats = () => {
    const totalWorkouts = workouts.length;
    const completedWorkouts = workouts.filter(w => w.completed_at).length;
    const totalSets = workouts.reduce((sum, w) => sum + w.totalSets, 0);
    const completedSets = workouts.reduce((sum, w) => sum + w.completedSets, 0);

    return {
      totalWorkouts,
      completedWorkouts,
      totalSets,
      completedSets,
      completionRate: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
    };
  };

  const renderWorkout = ({ item }: { item: WorkoutWithExercises }) => (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
    >
      <View style={styles.workoutHeader}>
        <Text style={styles.workoutName}>{item.name}</Text>
        <Text style={styles.workoutDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      {item.description && (
        <Text style={styles.workoutDescription}>{item.description}</Text>
      )}

      <View style={styles.workoutStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.totalExercises}</Text>
          <Text style={styles.statLabel}>Exercises</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {item.completedSets}/{item.totalSets}
          </Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {item.totalSets > 0 ? Math.round((item.completedSets / item.totalSets) * 100) : 0}%
          </Text>
          <Text style={styles.statLabel}>Complete</Text>
        </View>
      </View>

      {item.completed_at && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>Completed</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const stats = getWorkoutStats();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalWorkouts}</Text>
          <Text style={styles.statLabel}>Total Workouts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.completedWorkouts}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.completionRate}%</Text>
          <Text style={styles.statLabel}>Avg Completion</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterButtonText, filter === 'completed' && styles.filterButtonTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'incomplete' && styles.filterButtonActive]}
          onPress={() => setFilter('incomplete')}
        >
          <Text style={[styles.filterButtonText, filter === 'incomplete' && styles.filterButtonTextActive]}>
            In Progress
          </Text>
        </TouchableOpacity>
      </View>

      {/* Workout List */}
      {workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'No workouts yet'
              : filter === 'completed'
              ? 'No completed workouts'
              : 'No workouts in progress'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderWorkout}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.workoutList}
        />
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
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  workoutList: {
    padding: 20,
    paddingTop: 0,
  },
  workoutCard: {
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
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  workoutDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  workoutDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  completedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default WorkoutHistoryScreen;
