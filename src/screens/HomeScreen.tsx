import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { Workout } from '../types';

type RootStackParamList = {
  Home: undefined;
  CreateWorkout: undefined;
  WorkoutDetail: { workoutId: string };
  WorkoutHistory: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderWorkout = ({ item }: { item: Workout }) => (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
    >
      <Text style={styles.workoutName}>{item.name}</Text>
      <Text style={styles.workoutDescription}>
        {item.description || 'No description'}
      </Text>
      <Text style={styles.workoutDate}>
        Created: {new Date(item.created_at).toLocaleDateString()}
      </Text>
      {item.completed_at && (
        <Text style={styles.completedText}>
          Completed: {new Date(item.completed_at).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading workouts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back!</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CreateWorkout')}
        >
          <Text style={styles.primaryButtonText}>Create Workout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('WorkoutHistory')}
        >
          <Text style={styles.secondaryButtonText}>View History</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Your Workouts</Text>

      {workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No workouts yet</Text>
          <Text style={styles.emptySubtext}>
            Create your first workout to get started!
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
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  signOutButton: {
    padding: 8,
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  workoutList: {
    paddingBottom: 20,
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
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  workoutDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  workoutDate: {
    fontSize: 12,
    color: '#94a3b8',
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
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default HomeScreen;
