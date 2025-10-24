// app.js
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
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
    setDoc,
    onSnapshot
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

// State Management
let currentUser = null;
let userData = null;
let allCourses = [];
let userRegisteredCourses = [];

// Page Management
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    document.getElementById(pageId).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    if (pageId !== 'login-page' && pageId !== 'registration-page') {
        document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
    }
}

// Initialize the application
function initApp() {
    setupEventListeners();
    showPage('login-page');
}

// Event Listeners Setup
function setupEventListeners() {
    // Authentication
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignup);
    document.getElementById('goto-signup').addEventListener('click', () => showPage('registration-page'));
    document.getElementById('goto-login').addEventListener('click', () => showPage('login-page'));
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.getAttribute('data-page');
            showPage(page === 'dashboard' ? 'dashboard-page' : `${page}-page`);
            if (page === 'courses') loadCourses();
            if (page === 'my-courses') loadUserRegisteredCourses();
            if (page === 'profile') loadProfile();
        });
    });
    
    // Course Management
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    document.getElementById('department-filter').addEventListener('change', applyFilters);
    document.getElementById('level-filter').addEventListener('change', applyFilters);
    document.getElementById('credit-filter').addEventListener('change', applyFilters);
    document.getElementById('search-course').addEventListener('input', applyFilters);
    
    // Profile Management
    document.getElementById('profile-form').addEventListener('submit', saveProfile);
    document.getElementById('password-form').addEventListener('submit', changePassword);
    
    // Admin Management
    document.getElementById('add-course-btn').addEventListener('click', toggleCourseForm);
    document.getElementById('cancel-course-btn').addEventListener('click', toggleCourseForm);
    document.getElementById('course-form').addEventListener('submit', saveCourse);
}

// Authentication Handlers
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
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
}

async function handleSignup() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const role = document.getElementById('signup-role').value;
    
    if (!name || !email || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    try {
        showLoading(true);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            name: name,
            email: email,
            role: role,
            studentId: '',
            department: '',
            createdAt: new Date()
        });
        
        showNotification('Account created successfully!', 'success');
        showPage('login-page');
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showNotification('Logged out successfully', 'success');
        showPage('login-page');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

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
        populateFilters();
    } catch (error) {
        showNotification('Error loading courses: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderCourses(courses) {
    const coursesList = document.getElementById('courses-list');
    coursesList.innerHTML = '';
    
    if (courses.length === 0) {
        coursesList.innerHTML = '<p>No courses found matching your criteria.</p>';
        return;
    }
    
    courses.forEach(course => {
        const isRegistered = userRegisteredCourses.some(regCourse => regCourse.id === course.id);
        const isFull = course.registeredStudents && course.registeredStudents.length >= course.capacity;
        
        const courseCard = document.createElement('div');
        courseCard.className = `course-card ${isFull ? 'full' : ''}`;
        courseCard.innerHTML = `
            <h3>${course.name}</h3>
            <div class="course-code">${course.code}</div>
            <div class="course-info">
                <div><strong>Department:</strong> ${course.department}</div>
                <div><strong>Level:</strong> ${course.level}</div>
                <div><strong>Credits:</strong> ${course.credits}</div>
                <div><strong>Instructor:</strong> ${course.instructor}</div>
                <div class="capacity">
                    <strong>Enrollment:</strong> ${course.registeredStudents ? course.registeredStudents.length : 0}/${course.capacity}
                </div>
            </div>
            <p>${course.description || 'No description available.'}</p>
            <button onclick="registerForCourse('${course.id}')" 
                    ${isRegistered || isFull || !currentUser ? 'disabled' : ''}>
                ${isRegistered ? 'Already Registered' : isFull ? 'Course Full' : 'Register for Course'}
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
        updateDashboardStats();
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
        } else {
            userRegisteredCourses = [];
            renderRegisteredCourses();
        }
    } catch (error) {
        showNotification('Error loading registered courses: ' + error.message, 'error');
    }
}

function renderRegisteredCourses() {
    const registeredCourses = document.getElementById('registered-courses');
    const totalCreditsElement = document.getElementById('total-credits');
    
    if (userRegisteredCourses.length === 0) {
        registeredCourses.innerHTML = '<p>No courses registered for this semester.</p>';
        totalCreditsElement.textContent = '0';
        return;
    }
    
    let totalCredits = 0;
    registeredCourses.innerHTML = '';
    
    userRegisteredCourses.forEach(course => {
        totalCredits += course.credits;
        
        const courseElement = document.createElement('div');
        courseElement.className = 'registered-course';
        courseElement.innerHTML = `
            <h4>${course.code} - ${course.name}</h4>
            <div><strong>Credits:</strong> ${course.credits}</div>
            <div><strong>Instructor:</strong> ${course.instructor}</div>
            <div><strong>Schedule:</strong> To be announced</div>
            <button onclick="dropCourse('${course.id}')">Drop Course</button>
        `;
        registeredCourses.appendChild(courseElement);
    });
    
    totalCreditsElement.textContent = totalCredits;
}

async function dropCourse(courseId) {
    if (!confirm('Are you sure you want to drop this course?')) return;

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
        updateDashboardStats();
    } catch (error) {
        showNotification('Error dropping course: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Filter Functions
function populateFilters() {
    const departments = [...new Set(allCourses.map(course => course.department))];
    const departmentFilter = document.getElementById('department-filter');
    
    departmentFilter.innerHTML = '<option value="">All Departments</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentFilter.appendChild(option);
    });
}

function applyFilters() {
    let filteredCourses = [...allCourses];
    
    const department = document.getElementById('department-filter').value;
    const level = document.getElementById('level-filter').value;
    const credits = document.getElementById('credit-filter').value;
    const search = document.getElementById('search-course').value.toLowerCase();
    
    if (department) {
        filteredCourses = filteredCourses.filter(course => course.department === department);
    }
    
    if (level) {
        filteredCourses = filteredCourses.filter(course => course.level.toString() === level);
    }
    
    if (credits) {
        filteredCourses = filteredCourses.filter(course => course.credits.toString() === credits);
    }
    
    if (search) {
        filteredCourses = filteredCourses.filter(course => 
            course.name.toLowerCase().includes(search) ||
            course.code.toLowerCase().includes(search) ||
            course.instructor.toLowerCase().includes(search) ||
            course.department.toLowerCase().includes(search)
        );
    }
    
    renderCourses(filteredCourses);
}

function clearFilters() {
    document.getElementById('department-filter').value = '';
    document.getElementById('level-filter').value = '';
    document.getElementById('credit-filter').value = '';
    document.getElementById('search-course').value = '';
    applyFilters();
}

// Profile Management
async function loadProfile() {
    if (!currentUser || !userData) return;
    
    document.getElementById('profile-name').value = userData.name || '';
    document.getElementById('profile-email').value = userData.email || '';
    document.getElementById('profile-role').value = userData.role || 'student';
    document.getElementById('profile-student-id').value = userData.studentId || '';
    document.getElementById('profile-department').value = userData.department || '';
}

async function saveProfile(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('profile-student-id').value;
    const department = document.getElementById('profile-department').value;
    
    try {
        showLoading(true);
        await updateDoc(doc(db, 'users', currentUser.uid), {
            studentId: studentId,
            department: department,
            updatedAt: new Date()
        });
        
        showNotification('Profile updated successfully!', 'success');
    } catch (error) {
        showNotification('Error updating profile: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function changePassword(e) {
    e.preventDefault();
    
    const currentPass = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-new-password').value;
    
    if (!currentPass || !newPass || !confirmPass) {
        showNotification('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPass !== confirmPass) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        // Reauthenticate user
        const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Update password
        await updatePassword(currentUser, newPass);
        
        showNotification('Password updated successfully!', 'success');
        document.getElementById('password-form').reset();
    } catch (error) {
        showNotification('Error changing password: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Dashboard Functions
function updateDashboardStats() {
    document.getElementById('stat-registered').textContent = userRegisteredCourses.length;
    document.getElementById('stat-available').textContent = allCourses.length;
    
    const totalCredits = userRegisteredCourses.reduce((sum, course) => sum + course.credits, 0);
    document.getElementById('stat-credits').textContent = totalCredits;
    
    // Update recent courses
    const recentCourses = document.getElementById('recent-courses');
    if (userRegisteredCourses.length === 0) {
        recentCourses.innerHTML = '<p>No courses registered yet.</p>';
    } else {
        recentCourses.innerHTML = userRegisteredCourses.slice(0, 3).map(course => `
            <div class="recent-course">
                <strong>${course.code}</strong> - ${course.name}
            </div>
        `).join('');
    }
}

// Admin Functions
function toggleCourseForm() {
    const form = document.getElementById('add-course-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveCourse(e) {
    e.preventDefault();
    
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
        createdAt: new Date(),
        active: true
    };
    
    try {
        showLoading(true);
        await addDoc(collection(db, 'courses'), courseData);
        showNotification('Course added successfully!', 'success');
        document.getElementById('course-form').reset();
        toggleCourseForm();
        await loadCourses();
    } catch (error) {
        showNotification('Error adding course: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
        // User is signed in
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            userData = userDoc.data();
            
            // Update UI
            document.getElementById('nav-user-email').textContent = user.email;
            document.getElementById('dashboard-username').textContent = userData?.name || user.email;
            
            // Show main app
            showPage('main-app');
            showPage('dashboard-page');
            
            // Load user-specific data
            await loadCourses();
            await loadUserRegisteredCourses();
            updateDashboardStats();
            
            // Show admin page if user is admin
            if (userData?.role === 'admin') {
                document.getElementById('admin-page').style.display = 'block';
                showPage('admin-page');
            } else {
                document.getElementById('admin-page').style.display = 'none';
            }
            
        } catch (error) {
            showNotification('Error loading user data: ' + error.message, 'error');
        }
    } else {
        // User is signed out
        showPage('login-page');
        userData = null;
        allCourses = [];
        userRegisteredCourses = [];
    }
});

// Make functions available globally
window.showPage = showPage;
window.registerForCourse = registerForCourse;
window.dropCourse = dropCourse;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
