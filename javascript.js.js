// app.js
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove,
    query,
    where,
    orderBy,
    getDoc,
    setDoc
} from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDmlSXCAH_zzDUVlXW1JM8s5nbieW-EYv8",
    authDomain: "project-try001.firebaseapp.com",
    projectId: "project-try001",
    storageBucket: "project-try001.firebasestorage.app",
    messagingSenderId: "768302940514",
    appId: "1:768302940514:web:bd63fd925116383bb3ec3b",
    measurementId: "G-K86CX7GXB1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');

const studentDashboard = document.getElementById('student-dashboard');
const adminDashboard = document.getElementById('admin-dashboard');

const coursesList = document.getElementById('courses-list');
const registeredCourses = document.getElementById('registered-courses');
const departmentFilter = document.getElementById('department-filter');
const levelFilter = document.getElementById('level-filter');
const searchCourse = document.getElementById('search-course');

const addCourseBtn = document.getElementById('add-course-btn');
const addCourseForm = document.getElementById('add-course-form');
const saveCourseBtn = document.getElementById('save-course-btn');
const cancelCourseBtn = document.getElementById('cancel-course-btn');
const adminCoursesList = document.getElementById('admin-courses-list');

// State
let currentUser = null;
let allCourses = [];
let userRegisteredCourses = [];

// Authentication Functions
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        showNotification('Please enter email and password', 'error');
        return;
    }

    try {
        showLoading(true);
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Login successful!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
});

signupBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        showNotification('Please enter email and password', 'error');
        return;
    }

    try {
        showLoading(true);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: email,
            role: 'student', // Default role
            createdAt: new Date()
        });
        
        showNotification('Account created successfully!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showNotification('Logged out successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
        // User is signed in
        loginForm.style.display = 'none';
        logoutBtn.style.display = 'block';
        userInfo.style.display = 'block';
        userEmail.textContent = user.email;
        
        // Get user role and load appropriate dashboard
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        if (userData.role === 'admin') {
            adminDashboard.style.display = 'block';
            studentDashboard.style.display = 'none';
            loadAdminCourses();
        } else {
            adminDashboard.style.display = 'none';
            studentDashboard.style.display = 'block';
            await loadCourses();
            await loadUserRegisteredCourses();
        }
    } else {
        // User is signed out
        loginForm.style.display = 'block';
        logoutBtn.style.display = 'none';
        userInfo.style.display = 'none';
        studentDashboard.style.display = 'none';
        adminDashboard.style.display = 'none';
    }
});

// Course Management Functions
async function loadCourses() {
    try {
        showLoading(true);
        const querySnapshot = await getDocs(collection(db, 'courses'));
        allCourses = [];
        
        querySnapshot.forEach((doc) => {
            allCourses.push({ id: doc.id, ...doc.data() });
        });
        
        renderCourses(allCourses);
        populateDepartmentFilter();
    } catch (error) {
        showNotification('Error loading courses: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderCourses(courses) {
    coursesList.innerHTML = '';
    
    courses.forEach(course => {
        const isRegistered = userRegisteredCourses.some(regCourse => regCourse.id === course.id);
        const isFull = course.registeredStudents && course.registeredStudents.length >= course.capacity;
        
        const courseCard = document.createElement('div');
        courseCard.className = `course-card ${isFull ? 'full' : ''}`;
        courseCard.innerHTML = `
            <h3>${course.name}</h3>
            <div class="course-code">${course.code}</div>
            <div class="course-info">
                <div>Department: ${course.department}</div>
                <div>Level: ${course.level}</div>
                <div>Credits: ${course.credits}</div>
                <div>Instructor: ${course.instructor}</div>
                <div class="capacity">
                    Registered: ${course.registeredStudents ? course.registeredStudents.length : 0}/${course.capacity}
                </div>
            </div>
            <p>${course.description || ''}</p>
            <button onclick="registerForCourse('${course.id}')" 
                    ${isRegistered || isFull || !currentUser ? 'disabled' : ''}>
                ${isRegistered ? 'Registered' : isFull ? 'Full' : 'Register'}
            </button>
        `;
        coursesList.appendChild(courseCard);
    });
}

async function registerForCourse(courseId) {
    if (!currentUser) {
        showNotification('Please login to register for courses', 'error');
        return;
    }

    try {
        showLoading(true);
        const courseRef = doc(db, 'courses', courseId);
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Add course to user's registered courses
        await updateDoc(userRef, {
            registeredCourses: arrayUnion(courseId)
        });
        
        // Add user to course's registered students
        await updateDoc(courseRef, {
            registeredStudents: arrayUnion(currentUser.uid)
        });
        
        showNotification('Successfully registered for course!', 'success');
        await loadCourses();
        await loadUserRegisteredCourses();
    } catch (error) {
        showNotification('Error registering for course: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function loadUserRegisteredCourses() {
    if (!currentUser) return;

    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (userData.registeredCourses) {
            userRegisteredCourses = allCourses.filter(course => 
                userData.registeredCourses.includes(course.id)
            );
            renderRegisteredCourses();
        }
    } catch (error) {
        showNotification('Error loading registered courses: ' + error.message, 'error');
    }
}

function renderRegisteredCourses() {
    registeredCourses.innerHTML = '';
    
    if (userRegisteredCourses.length === 0) {
        registeredCourses.innerHTML = '<p>No courses registered yet.</p>';
        return;
    }
    
    userRegisteredCourses.forEach(course => {
        const courseElement = document.createElement('div');
        courseElement.className = 'registered-course';
        courseElement.innerHTML = `
            <h4>${course.code} - ${course.name}</h4>
            <div>Credits: ${course.credits}</div>
            <div>Instructor: ${course.instructor}</div>
            <button onclick="dropCourse('${course.id}')">Drop Course</button>
        `;
        registeredCourses.appendChild(courseElement);
    });
}

async function dropCourse(courseId) {
    try {
        showLoading(true);
        const courseRef = doc(db, 'courses', courseId);
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Remove course from user's registered courses
        await updateDoc(userRef, {
            registeredCourses: arrayRemove(courseId)
        });
        
        // Remove user from course's registered students
        await updateDoc(courseRef, {
            registeredStudents: arrayRemove(currentUser.uid)
        });
        
        showNotification('Course dropped successfully!', 'success');
        await loadCourses();
        await loadUserRegisteredCourses();
    } catch (error) {
        showNotification('Error dropping course: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Filter Functions
function populateDepartmentFilter() {
    const departments = [...new Set(allCourses.map(course => course.department))];
    departmentFilter.innerHTML = '<option value="">All Departments</option>';
    
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentFilter.appendChild(option);
    });
}

departmentFilter.addEventListener('change', applyFilters);
levelFilter.addEventListener('change', applyFilters);
searchCourse.addEventListener('input', applyFilters);

function applyFilters() {
    let filteredCourses = [...allCourses];
    
    const department = departmentFilter.value;
    const level = levelFilter.value;
    const search = searchCourse.value.toLowerCase();
    
    if (department) {
        filteredCourses = filteredCourses.filter(course => course.department === department);
    }
    
    if (level) {
        filteredCourses = filteredCourses.filter(course => course.level.toString() === level);
    }
    
    if (search) {
        filteredCourses = filteredCourses.filter(course => 
            course.name.toLowerCase().includes(search) ||
            course.code.toLowerCase().includes(search) ||
            course.instructor.toLowerCase().includes(search)
        );
    }
    
    renderCourses(filteredCourses);
}

// Admin Functions
addCourseBtn.addEventListener('click', () => {
    addCourseForm.style.display = addCourseForm.style.display === 'none' ? 'block' : 'none';
});

cancelCourseBtn.addEventListener('click', () => {
    addCourseForm.style.display = 'none';
    clearCourseForm();
});

saveCourseBtn.addEventListener('click', async () => {
    const courseData = {
        code: document.getElementById('course-code').value,
        name: document.getElementById('course-name').value,
        department: document.getElementById('course-department').value,
        level: parseInt(document.getElementById('course-level').value),
        credits: parseInt(document.getElementById('course-credits').value),
        capacity: parseInt(document.getElementById('course-capacity').value),
        instructor: document.getElementById('course-instructor').value,
        description: document.getElementById('course-description').value,
        registeredStudents: [],
        createdAt: new Date()
    };
    
    // Validation
    if (!courseData.code || !courseData.name || !courseData.department) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        showLoading(true);
        await addDoc(collection(db, 'courses'), courseData);
        showNotification('Course added successfully!', 'success');
        clearCourseForm();
        addCourseForm.style.display = 'none';
        await loadAdminCourses();
    } catch (error) {
        showNotification('Error adding course: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
});

async function loadAdminCourses() {
    try {
        const querySnapshot = await getDocs(collection(db, 'courses'));
        adminCoursesList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const course = { id: doc.id, ...doc.data() };
            const courseElement = document.createElement('div');
            courseElement.className = 'course-card';
            courseElement.innerHTML = `
                <h3>${course.code} - ${course.name}</h3>
                <div>Department: ${course.department}</div>
                <div>Level: ${course.level} | Credits: ${course.credits}</div>
                <div>Instructor: ${course.instructor}</div>
                <div>Capacity: ${course.registeredStudents ? course.registeredStudents.length : 0}/${course.capacity}</div>
                <button onclick="deleteCourse('${course.id}')">Delete</button>
            `;
            adminCoursesList.appendChild(courseElement);
        });
    } catch (error) {
        showNotification('Error loading courses: ' + error.message, 'error');
    }
}

async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    
    try {
        showLoading(true);
        // Note: In a real application, you might want to use deleteDoc
        // but we'll just update the course to be inactive
        await updateDoc(doc(db, 'courses', courseId), {
            active: false
        });
        showNotification('Course deleted successfully!', 'success');
        await loadAdminCourses();
    } catch (error) {
        showNotification('Error deleting course: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function clearCourseForm() {
    document.getElementById('course-code').value = '';
    document.getElementById('course-name').value = '';
    document.getElementById('course-department').value = '';
    document.getElementById('course-level').value = '';
    document.getElementById('course-credits').value = '';
    document.getElementById('course-capacity').value = '';
    document.getElementById('course-instructor').value = '';
    document.getElementById('course-description').value = '';
}

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = type;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Make functions available globally for onclick handlers
window.registerForCourse = registerForCourse;
window.dropCourse = dropCourse;
window.deleteCourse = deleteCourse;